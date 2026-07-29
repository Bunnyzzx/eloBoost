// Impede que uma janela de console apareça junto com o aplicativo no Windows
// em builds de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    eloboost_lib::run();
}
