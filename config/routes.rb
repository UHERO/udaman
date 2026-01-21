# Note to self, the following are standard REST actions, and are
# generally handled automatically. The routes in this file are custom
# and must be defined explicitly. As of 3/18/25, I'm converting the
# old and very open wildcard handler and to explicit routes. TEDIOUS
#    index (GET)
#    show (GET)
#    new (GET)
#    create (POST)
#    edit (GET)
#    update (PATCH/PUT)
#    destroy (DELETE)
#
# I have added a route for every controller method, but note that not every method necessarily
# gets called from the UI, methods called from within the controller or another controller
# should not need a route here, but that's a task for another time.

# Routes are organized in 2 groups
#  1. Single routes
#  2. controllers with custom routes
#  3. remaining controllers alphabetically

Rails.application.routes.draw do
  get "autocomplete" => "series#autocomplete_search"
  post "csv2tsd" => "series#csv2tsd"
  get "misc/get_branch_code" => "misc#get_branch_code"
  get "investigate_visual" => "dashboards#investigate_visual"
  get "export_tsd" => "dashboards#export_tsd"
  # removed but leaving for reference. If a route or controller is broken, I want to see the error
  # get '*path' => redirect('/')  ## redirect all unknown routes to /

  resources :api_applications
  resources :feature_toggles, only: [:index]
  resources :geographies
  resources :source_details
  resources :tsd_files
  resources :sources
  root to: "series#index"
  resources :units
  devise_for :users

  require "sidekiq/web"
  authenticate :user, ->(user) { user.admin_user? } do
    mount Sidekiq::Web => "/sidekiq"
  end

  resources :categories do
    member do
      get "up"
      get "down"
      get "toggle_hidden" # Assuming this changes state
      get "add_child" # If this is a form
      post "add_child" # If this actually creates a child
    end
  end

  resources :dashboards, only: [] do
    collection do
      get "export_tsd"
      get "investigate_visual"
      post "restart_dvwapi"
      post "restart_restapi"
      post "update_public_dp"
      post "force_sync_files"
      post "clear_api_cache"
      post "rerun_job"
      delete "destroy_reload_job"
    end
  end

  resources :data_lists do
    member do
      get "duplicate"
      get "super_table"
      post "super_table"
      get "show_table"
      get "show_tsd_super_table"
      get "show_tsd_table"
      get "analyze_view"
      get "edit_as_text"
      patch "save_as_text"
      post "add_clip"
      post "add_measurement"
      delete "remove_measurement"
      patch "move_measurement_up"
      patch "move_measurement_down"
      patch "set_measurement_indent"
    end

    collection do
      post "super_table/:id" => "data_lists#super_table"
    end
  end

  resources :data_points, only: [] do
    collection do
      get "show/:xseries_id/:date" => "data_points#show", :as => :show
    end
  end

  resources :data_sources do
    member do
      get "delete"
      get "source"
      get "clear"
      post "do_clear"
      get "reset"
      get "disable"
      get "toggle_reload_nightly"
      post "inline_update"
    end
  end

  resources :dbedt_uploads do
    member do
      get "status/:which" => "dbedt_uploads#status"
      get "active_status" => "dbedt_uploads#active_status"
      get "make_active" => "dbedt_uploads#make_active"
    end
  end

  resources :downloads do
    member do
      get "duplicate"
      get "download"
    end

    collection do
      get "by_pattern"
      get "pull_file"
      post "test_url"
      post "test_save_path"
      post "test_post_params"
    end
  end

  resources :new_dbedt_uploads, only: [:index, :show, :create] do
    member do
      get "status/:which" => "new_dbedt_uploads#status"
      get "active_status" => "new_dbedt_uploads#active_status"
    end
  end

  resources :dvw_uploads do
    member do
      get "status/:which" => "dvw_uploads#status"
      get "active_status" => "dvw_uploads#active_status"
      get "make_active" => "dvw_uploads#make_active"
    end
  end

  resources :exports do
    member do
      get "show_table"
      get "add_series/:series_id", to: "exports#add_series", as: "add_series"
      get "edit_as_text", to: "exports#edit_as_text"
      post "save_as_text", to: "exports#save_as_text"
      post "import_clip", to: "exports#import_clip"
      post "add_clip", to: "exports#add_clip"
      delete "remove_series", to: "exports#remove_series"
      get "move_series_up", to: "exports#move_series_up"
      get "move_series_down", to: "exports#move_series_down"
    end
  end

  resources :forecast_snapshots do
    member do
      get "table"
      get "duplicate"
      get "pull_file"
    end
    post "table", to: "forecast_snapshots#table" # Keep if POST to table is required
    post "", to: "forecast_snapshots#show" # Is a POST to show required?
  end

  resources :measurements do
    member do
      get "duplicate"
      get "add_series/:series_id",
          to: "measurements#add_series",
          as: "add_series"
      get "edit_as_text"
      patch "save_as_text"
      post "import_clip"
      post "add_clip"
      delete "remove_series"
      get "propagate"
      post "propagate"
    end
  end

  resources :series do
    collection do
      get "bulk" => "series#bulk_new"
      post "bulk" => "series#bulk_create"
      get "search"
      get "no_source"
      get "no_source_no_restrict"
      get "forecast_upload"
      post "forecast_do_upload"
      get "quarantine"
      get "empty_quarantine"
      get "meta_update"
      post "meta_store"
      get "clip", to: "series#clipboard"
      get "add_clip"
      get "clear_clip"
      post "do_clip_action"
      get "autocomplete_search"
      get "group_export"
      get "new_search"
      post "new_search"
      get "csv2tsd_upload"
      post "csv2tsd"
      get "transform"
      post "transform"
      get "analyze/:id", to: "series#analyze"  # Legacy route for /series/analyze/:id
    end

    member do
      get "new_alias"
      post "alias_create"
      get "analyze"
      get "add_to_quarantine"
      get "remove_from_quarantine"
      get "reload_all"
      get "rename"
      post "save_rename"
      get "duplicate"
      post "save_duplicate"
      get "json_with_change"
      get "show_forecast"
      get "all_tsd_chart"
      get "render_data_points"
      post "update_notes"
      get "clear"
      post "do_clear"
    end
  end
end
