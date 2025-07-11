pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // all of our `panic!`s will be printed to the console by default.
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}