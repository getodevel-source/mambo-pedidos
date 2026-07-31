/**
 * Mambo Pedidos — Signed Updater Smoke Harness (Slice 4)
 *
 * Validates updater manifest structure, public key configuration,
 * placeholder rejection, and tamper detection logic.
 * Actual download/install/restart requires TAURI_SIGNED_SMOKE=1 + Tauri runtime.
 */
const crypto = require('crypto');

const UpdaterSmoke = {
  /**
   * Validate a release manifest structure.
   * @param {Object} manifest - { version, platform, url, signature, hash, publicKey }
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateManifest(manifest) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, errors: ['Manifest is not an object'] };
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
      errors.push('Missing or invalid version');
    }
    if (!manifest.platform || typeof manifest.platform !== 'string') {
      errors.push('Missing or invalid platform');
    }
    if (!manifest.url || typeof manifest.url !== 'string') {
      errors.push('Missing or invalid metadata URL');
    }
    if (!manifest.hash || typeof manifest.hash !== 'string') {
      errors.push('Missing or invalid artifact hash');
    }
    if (!manifest.publicKey || typeof manifest.publicKey !== 'string') {
      errors.push('Missing or invalid publicKey');
    }
    return { valid: errors.length === 0, errors };
  },

  /**
   * Reject placeholder or obviously invalid public keys.
   * @param {string} key - The configured public key
   * @returns {{ accepted: boolean, reason: string }}
   */
  validatePublicKey(key) {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return { accepted: false, reason: 'Empty or missing public key' };
    }
    const PLACEHOLDERS = [
      'YOUR_PUBLIC_KEY', 'REPLACE_ME', 'TODO', 'PLACEHOLDER',
      'changeme', 'test-key', 'dummy', 'INSERT_KEY', 'PASTE_HERE'
    ];
    const upper = key.toUpperCase().trim();
    for (const p of PLACEHOLDERS) {
      if (upper.includes(p.toUpperCase())) {
        return { accepted: false, reason: `Placeholder key detected: contains "${p}"` };
      }
    }
    if (key.trim().length < 20) {
      return { accepted: false, reason: 'Public key too short (< 20 chars)' };
    }
    return { accepted: true, reason: 'Public key format acceptable' };
  },

  /**
   * Verify that metadata fields agree: version matches, platform matches, hash is valid sha256.
   * @param {Object} metadata - { version, platform, hash }
   * @param {Object} expected - { version, platform }
   * @returns {{ agreed: boolean, errors: string[] }}
   */
  verifyMetadataAgreement(metadata, expected) {
    const errors = [];
    if (!metadata || !expected) {
      return { agreed: false, errors: ['Missing metadata or expected'] };
    }
    if (metadata.version !== expected.version) {
      errors.push(`Version mismatch: metadata="${metadata.version}" expected="${expected.version}"`);
    }
    if (metadata.platform !== expected.platform) {
      errors.push(`Platform mismatch: metadata="${metadata.platform}" expected="${expected.platform}"`);
    }
    if (metadata.hash && !/^[a-f0-9]{64}$/i.test(metadata.hash)) {
      errors.push(`Hash is not valid SHA-256: "${metadata.hash}"`);
    }
    return { agreed: errors.length === 0, errors };
  },

  /**
   * Simulate tamper detection: compare artifact hash against expected.
   * @param {string|Buffer} artifactContent - The downloaded artifact bytes
   * @param {string} expectedHash - Expected SHA-256 hex
   * @returns {{ verified: boolean, actualHash: string, reason: string }}
   */
  verifyArtifactHash(artifactContent, expectedHash) {
    const actualHash = crypto.createHash('sha256')
      .update(typeof artifactContent === 'string' ? Buffer.from(artifactContent) : artifactContent)
      .digest('hex');
    const verified = actualHash === expectedHash.toLowerCase();
    return {
      verified,
      actualHash,
      reason: verified ? 'Hash matches expected' : `Hash mismatch: actual=${actualHash} expected=${expectedHash}`
    };
  },

  /**
   * Simulate signature verification (structural check, not cryptographic).
   * In production, Tauri's updater plugin does real ed25519 verification.
   * @param {string} signature - The .sig content
   * @param {string} publicKey - The configured public key
   * @returns {{ verified: boolean, reason: string }}
   */
  verifySignatureStructure(signature, publicKey) {
    if (!signature || typeof signature !== 'string' || signature.trim().length === 0) {
      return { verified: false, reason: 'Empty or missing signature' };
    }
    const keyCheck = this.validatePublicKey(publicKey);
    if (!keyCheck.accepted) {
      return { verified: false, reason: `Public key rejected: ${keyCheck.reason}` };
    }
    // Structural: signature should be base64-encoded, reasonable length
    if (!/^[A-Za-z0-9+/=\s]+$/.test(signature.trim())) {
      return { verified: false, reason: 'Signature is not valid base64' };
    }
    if (signature.trim().length < 40) {
      return { verified: false, reason: 'Signature too short for ed25519' };
    }
    return { verified: true, reason: 'Signature structure acceptable (cryptographic verification requires Tauri runtime)' };
  },

  /**
   * Full ordered smoke sequence (structural, env-gated for real execution).
   * Returns the ordered evidence trail.
   * @param {Object} opts - { manifest, artifactContent, signature, env }
   * @returns {{ sequence: string[], result: string, evidence: Object }}
   */
  runSmokeSequence(opts) {
    const { manifest, artifactContent, signature, env } = opts || {};
    const sequence = [];
    const evidence = {};

    // Step 1: Environment gate
    sequence.push('check-environment');
    const gated = env && env.TAURI_SIGNED_SMOKE === '1';
    if (!gated) {
      evidence.gate = 'SKIPPED_ENVIRONMENT_GATED';
      evidence.reason = 'TAURI_SIGNED_SMOKE=1 not set';
      return { sequence, result: 'SKIPPED_ENVIRONMENT_GATED', evidence };
    }

    // Step 2: Validate manifest
    sequence.push('validate-manifest');
    const manifestCheck = this.validateManifest(manifest);
    evidence.manifest = manifestCheck;
    if (!manifestCheck.valid) {
      return { sequence, result: 'REJECTED_MANIFEST_INVALID', evidence };
    }

    // Step 3: Validate public key
    sequence.push('validate-public-key');
    const keyCheck = this.validatePublicKey(manifest.publicKey);
    evidence.publicKey = keyCheck;
    if (!keyCheck.accepted) {
      return { sequence, result: 'REJECTED_PLACEHOLDER_KEY', evidence };
    }

    // Step 4: Verify metadata agreement
    sequence.push('verify-metadata');
    const metaCheck = this.verifyMetadataAgreement(
      { version: manifest.version, platform: manifest.platform, hash: manifest.hash },
      { version: manifest.version, platform: manifest.platform }
    );
    evidence.metadata = metaCheck;
    if (!metaCheck.agreed) {
      return { sequence, result: 'REJECTED_METADATA_MISMATCH', evidence };
    }

    // Step 5: Verify signature structure
    sequence.push('verify-signature');
    const sigCheck = this.verifySignatureStructure(signature, manifest.publicKey);
    evidence.signature = sigCheck;
    if (!sigCheck.verified) {
      return { sequence, result: 'REJECTED_SIGNATURE_INVALID', evidence };
    }

    // Step 6: Verify artifact hash
    sequence.push('verify-artifact-hash');
    if (artifactContent !== undefined && artifactContent !== null) {
      const hashCheck = this.verifyArtifactHash(artifactContent, manifest.hash);
      evidence.artifactHash = hashCheck;
      if (!hashCheck.verified) {
        return { sequence, result: 'REJECTED_ARTIFACT_TAMPERED', evidence };
      }
    } else {
      evidence.artifactHash = { verified: false, reason: 'No artifact content provided' };
      return { sequence, result: 'REJECTED_NO_ARTIFACT', evidence };
    }

    // Step 7: Install (structural — real install requires Tauri)
    sequence.push('install');
    evidence.install = 'structural-only';

    // Step 8: Restart sentinel
    sequence.push('restart-sentinel');
    evidence.sentinel = 'structural-only';

    return { sequence, result: 'PASS_STRUCTURAL', evidence };
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = UpdaterSmoke;
if (typeof window !== 'undefined') window.UpdaterSmoke = UpdaterSmoke;
