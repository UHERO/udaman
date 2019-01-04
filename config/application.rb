require_relative 'boot'

require 'rails/all'

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module UheroDb
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 5.0

    # Settings in config/environments/* take precedence over those specified here.
    # Application configuration can go into files in config/initializers
    # -- all .rb files in that directory are automatically loaded after loading
    # the framework and any gems in your application.
    #
    config.autoload_paths += Dir["#{config.root}/lib/**/"] # include all subdirectories

    #file writing is roughly just as performant, except memory naturally clears after each process (separate from
    # web, console, and rake) which is generally better
    config.cache_store = :memory_store #, :size => 64.megabytes

    # Only load the plugins named here, in the order given (default is alphabetical).
    # :all can be used as a placeholder for all plugins not explicitly named.
    # config.plugins = [ :exception_notification, :ssl_requirement, :all ]

    # Activate observers that should always be running.
    # config.active_record.observers = :cacher, :garbage_collector, :forum_observer

    # Set Time.zone default to the specified zone and make Active Record auto-convert to this zone.
    # Run "rake -D time" for a list of tasks for finding time zone names. Default is UTC.
    # config.time_zone = 'Central Time (US & Canada)'

    # The default locale is :en and all translations from config/locales/*.rb,yml are auto loaded.
    # config.i18n.load_path += Dir[Rails.root.join('my', 'locales', '*.{rb,yml}').to_s]
    # config.i18n.default_locale = :de

    # JavaScript files you want as :defaults (application.js is always included).
    ###config.action_view.javascript_expansions[:defaults] = %w(jquery rails)
    #config.action_view.JavaScript_expansions[:defaults] = %w(jquery rails application)

    # Configure the default encoding used in templates for Ruby 1.9.
    config.encoding = 'utf-8'

    config.log_formatter = proc do |sev, time, progname, msg|
      "#{time.strftime('%F %T')} [#{progname ? sev+' '+progname : sev}]: #{msg}\n"
    end

    ActiveSupport.halt_callback_chains_on_return_false = false
  end
end
