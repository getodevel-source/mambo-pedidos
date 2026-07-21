// Mambo Pedidos - Entry point
// Previene la ventana de consola en Windows en release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mambo_pedidos_lib::run()
}
