# No gem activation during Ruby loader initialization

## Context

Passenger loads a Ruby app using loader scripts (rack-loader.rb and rack-preloader.rb). These scripts perform these steps:

1. Initialization, e.g., to setup communication with the Passenger Core.
2. Activate Bundler.
3. Load the application (config.ru).

If step 1 activates any gems, then that may conflict with Bundler activation because Gemfile could specify a different gem version.

## Decision

All code callable by the Ruby loaders' initialization steps, must not activate any gems.

## Consequences

Any needed functionality that's typically provided by gems, must be reimplemented within the `PhusionPassenger` module.

For example, the initialization step needs to parse JSON. Instead of activating the JSON gem, we reimplement a JSON parser in `PhusionPassenger::Utils::JSON`.

### Caveat: standard library gems

More and more parts of the Ruby standard library are becoming [gemified](https://stdgems.org/). This increases the chances of the initialization step activating a standard library gem. In principle, our strategy remains the same: we reimplement those libraries. For example, we reimplemented StringScanner (needed by our JSON implementation) in `PhusionPassenger::Utils::StringScanner`, but we limited its scope to just the functionality needed by the JSON implementation.

If the standard library in question is a native extension (e.g., `etc`), then the strategy is to reimplement it in C++ as part of the [Passenger Agent binary](../../src/agent/README.md), as a separately callable tool. The Ruby code then spawns the written-in-C++ tool and parses its output.
