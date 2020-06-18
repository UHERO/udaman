Rails.application.routes.draw do
# For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  resources :units
  resources :feature_toggles
  resources :user_feedbacks
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
  resources :transformations
  resources :categories
  resources :geographies
  resources :dbedt_uploads do
    member do
      get 'status/:which' => 'dbedt_uploads#status'
      get 'active_status' => 'dbedt_uploads#active_status'
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
  get 'series/quarantine', to: 'series#quarantine'
  get 'series/old_bea_download', to: 'series#old_bea_download'
  get 'series/sidekiq_failed', to: 'series#sidekiq_failed'

  resources :series

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
  get 'export_tsd' => 'dashboards#export_tsd'
  get 'rake_report' => 'dashboards#rake_report'
  get 'construction' => 'dashboards#construction'
  get 'construction/years/:num_years' => 'dashboards#construction'
  get 'construction_q' => 'dashboards#construction_quarterly'
  get 'construction_q/years/:num_years' => 'dashboards#construction_quarterly'
  get 'hbr_mbr' => 'dashboards#hbr_mbr'
  get 'hbr_mbr/years/:num_years' => 'dashboards#hbr_mbr'
  get 'permits' => 'dashboards#permits'
  get 'permits/years/:num_years' => 'dashboards#permits'
  get 'prudential' => 'dashboards#prudential'
  get 'prudential/years/:num_years' => 'dashboards#prudential'

  get 'employment' => 'dashboards#employment'
  get 'employment/years/:num_years' => 'dashboards#employment'
  get 'employment_us' => 'dashboards#employment_us'
  get 'employment_us/years/:num_years' => 'dashboards#employment_us'
  get 'employment_hon' => 'dashboards#employment_hon'
  get 'employment_hon/years/:num_years' => 'dashboards#employment_hon'
  get 'employment_mau' => 'dashboards#employment_mau'
  get 'employment_mau/years/:num_years' => 'dashboards#employment_mau'
  get 'employment_haw' => 'dashboards#employment_haw'
  get 'employment_haw/years/:num_years' => 'dashboards#employment_haw'
  get 'employment_kau' => 'dashboards#employment_kau'
  get 'employment_kau/years/:num_years' => 'dashboards#employment_kau'

  get 'income' => 'dashboards#income'
  get 'income_r' => 'dashboards#income_r'

  get 'tax_m' => 'dashboards#tax_m'
  

  get 'visitor' => 'dashboards#visitor_hi_m'
  get 'visitor_hon' => 'dashboards#visitor_hon_m'
  get 'visitor_mau' => 'dashboards#visitor_mau_m'
  get 'visitor_haw' => 'dashboards#visitor_haw_m'
  get 'visitor_kau' => 'dashboards#visitor_kau_m'
  
  get 'visitor_q' => 'dashboards#visitor_hi_q'
  get 'visitor_hon_q' => 'dashboards#visitor_hon_q'
  get 'visitor_mau_q' => 'dashboards#visitor_mau_q'
  get 'visitor_haw_q' => 'dashboards#visitor_haw_q'
  get 'visitor_kau_q' => 'dashboards#visitor_kau_q'

  get 'visitor_a' => 'dashboards#visitor_hi_a'
  get 'visitor_hon_a' => 'dashboards#visitor_hon_a'
  get 'visitor_mau_a' => 'dashboards#visitor_mau_a'
  get 'visitor_haw_a' => 'dashboards#visitor_haw_a'
  get 'visitor_kau_a' => 'dashboards#visitor_kau_a'

  get 'prudential_list_q' => 'dashboards#prudential_list_q'
  
  get 'mapping' => 'dashboards#mapping'

  get 'autocomplete' => 'series#autocomplete_search'
  get 'series/search' => 'series#new_search'

  get 'downloads/by_pattern' => 'downloads#by_pattern'
  get 'downloads/pull_file' => 'downloads#pull_file'
  post 'downloads/test_url' => 'downloads#test_url'
  post 'downloads/test_save_path' => 'downloads#test_save_path'
  post 'downloads/test_post_params' => 'downloads#test_post_params'
  resources :downloads

  get 'help/index' => 'help#index'
  get 'help/data_sources' => 'help#data_sources'

  # See how all your routes lay out with "rake routes"

  # This is a legacy wild controller route that's not recommended for RESTful applications.
  # Note: This route will make all actions in every controller accessible via GET requests.
  match ':controller(/:action(/:id(.:format)))', via: :all

  get '*path' => redirect('/')  ## redirect all unknown routes to /
end
