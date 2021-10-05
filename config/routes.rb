Rails.application.routes.draw do
# For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  resources :units
  resources :feature_toggles
  resources :source_details
  resources :tsd_files
  resources :forecast_snapshots do
    member do
      get 'table'
    end
  end
  post 'forecast_snapshots/:id/table', to: 'forecast_snapshots#table'
  post 'forecast_snapshots/:id', to: 'forecast_snapshots#show'

  resources :exports
  resources :measurements do
    member do
      get 'duplicate'
    end
  end
  resources :api_applications
  resources :sources
  resources :categories
  resources :geographies
  resources :dbedt_uploads do
    member do
      get 'status/:which' => 'dbedt_uploads#status'
      get 'active_status' => 'dbedt_uploads#active_status'
    end
  end
  resources :new_dbedt_uploads do
    member do
      get 'status/:which' => 'new_dbedt_uploads#status'
      get 'active_status' => 'new_dbedt_uploads#active_status'
    end
  end
  resources :dvw_uploads do
    member do
      get 'status/:which' => 'dvw_uploads#status'
      get 'active_status' => 'dvw_uploads#active_status'
    end
  end

  get 'data_points/:series_id/:date_string' => 'data_points#show'
  get 'exports/:id/add_series/:series_id' => 'exports#add_series'
  get 'measurements/:id/add_series/:series_id' => 'measurements#add_series'

  root :to => 'series#index'

  devise_for :users

  require 'sidekiq/web'
  authenticate :user, ->(user) { user.admin_user? } do
    mount Sidekiq::Web => '/sidekiq'
  end

  get 'series/bulk', to: 'series#bulk_new'
  post 'series/bulk', to: 'series#bulk_create'
  get 'series/no_source', to: 'series#no_source'
  get 'series/no_source_no_restrict', to: 'series#no_source_no_restrict'
  get 'series/forecast_upload', to: 'series#forecast_upload'
  post 'series/forecast_upload', to: 'series#forecast_do_upload'
  get 'series/quarantine', to: 'series#quarantine'
  get 'series/meta_update', to: 'series#meta_update'

  get 'clip' => 'series#clipboard'
  get 'series/add_clip', to: 'series#add_clip'
  get 'series/clear_clip', to: 'series#clear_clip'
  get 'series/group_export', to: 'series#group_export'
  post 'series/do_clip_action', to: 'series#do_clip_action'

  resources :data_sources
  resources :dashboards
  resources :data_lists do
    member do
      get 'duplicate'
    end
  end

  get 'investigate' => 'dashboards#investigate'
  get 'investigate_visual' => 'dashboards#investigate_visual'
  post 'update_public_dp' => 'dashboards#update_public_dp'
  post 'restart_restapi' => 'dashboards#restart_restapi'
  post 'restart_dvwapi' => 'dashboards#restart_dvwapi'
  get 'export_tsd' => 'dashboards#export_tsd'
  get 'autocomplete' => 'series#autocomplete_search'
  get 'series/search' => 'series#new_search'


  resources :series

  get 'downloads/by_pattern' => 'downloads#by_pattern'
  get 'downloads/pull_file' => 'downloads#pull_file'
  post 'downloads/test_url' => 'downloads#test_url'
  post 'downloads/test_save_path' => 'downloads#test_save_path'
  post 'downloads/test_post_params' => 'downloads#test_post_params'
  resources :downloads

  get 'misc/get_branch_code' => 'misc#get_branch_code'

  # See how all your routes lay out with "rake routes"

  # This is a legacy wild controller route that's not recommended for RESTful applications.
  # Note: This route will make all actions in every controller accessible via GET requests.
  match ':controller(/:action(/:id(.:format)))', via: :all

  get '*path' => redirect('/')  ## redirect all unknown routes to /
end
