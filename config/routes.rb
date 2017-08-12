UheroDb::Application.routes.draw do

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
  resources :nta_uploads do
    member do
      get 'status/:which' => 'nta_uploads#status'
      get 'active_status' => 'nta_uploads#active_status'
    end
  end

  get 'data_points/:series_id/:date_string' => 'data_points#show'
  get 'exports/:id/add_series/:series_id' => 'exports#add_series'
  get 'measurements/:id/add_series/:series_id' => 'measurements#add_series'

  root :to => 'series#index'

  devise_for :users

  require 'sidekiq/web'
  authenticate :user do
    mount Sidekiq::Web => '/sidekiq'
  end

  #map.devise_for :users
  
  get 'series/bulk', to: 'series#bulk_new'
  post 'series/bulk', to: 'series#bulk_create'
  get 'series/stale', to: 'series#stale'
  get 'series/no_source', to: 'series#no_source'
  get 'series/no_source_no_restrict', to: 'series#no_source_no_restrict'
  get 'series/quarantine', to: 'series#quarantine'

  resources :series

  resources :data_sources
  resources :prognoz_data_files
  resources :series_data_files
  resources :dashboards
  resources :data_lists do
    member do
      get 'duplicate'
    end
  end

  get 'broken_data_sources' => 'dashboards#broken_data_sources'
  get 'search_data_sources' => 'dashboards#search_data_sources'
  get 'send_prognoz_export' => 'prognoz_data_files#send_prognoz_export'
  get 'investigate' => 'dashboards#investigate'
  get 'investigate_visual' => 'dashboards#investigate_visual'
  post 'update_public_dp' => 'dashboards#update_public_dp'
  get 'investigate_no_source' => 'dashboards#investigate_no_source'
  get 'udamacmini_comparison' => 'dashboards#udamacmini_comparison'
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

  get 'listseries/search' => 'listseries#search'
  get 'listseries/re' =>'listseries#redir'
  get 'listseries/:name' => 'listseries#get'
  
  get 'autocomplete' => 'series#autocomplete_search'

  post 'downloads/test_url' => 'downloads#test_url'
  post 'downloads/test_save_path' => 'downloads#test_save_path'
  post 'downloads/test_post_params' => 'downloads#test_post_params'
  resources :downloads

  #match 'path' => 'controller#method'
  # The priority is based upon order of creation:
  # first created -> highest priority.

  # Sample of regular route:
  #   match 'products/:id' => 'catalog#view'
  # Keep in mind you can assign values other than :controller and :action

  # Sample of named route:
  #   match 'products/:id/purchase' => 'catalog#purchase', :as => :purchase
  # This route can be invoked with purchase_url(:id => product.id)

  # Sample resource route (maps HTTP verbs to controller actions automatically):
  #   resources :products

  # Sample resource route with options:
  #   resources :products do
  #     member do
  #       get 'short'
  #       post 'toggle'
  #     end
  #
  #     collection do
  #       get 'sold'
  #     end
  #   end

  # Sample resource route with sub-resources:
  #   resources :products do
  #     resources :comments, :sales
  #     resource :seller
  #   end

  # Sample resource route with more complex sub-resources
  #   resources :products do
  #     resources :comments
  #     resources :sales do
  #       get 'recent', :on => :collection
  #     end
  #   end

  # Sample resource route within a namespace:
  #   namespace :admin do
  #     # Directs /admin/products/* to Admin::ProductsController
  #     # (app/controllers/admin/products_controller.rb)
  #     resources :products
  #   end

  # You can have the root of your site routed with "root"
  # just remember to delete public/index.html.
  # root :to => "welcome#index"

  # See how all your routes lay out with "rake routes"

  # This is a legacy wild controller route that's not recommended for RESTful applications.
  # Note: This route will make all actions in every controller accessible via GET requests.
  match ':controller(/:action(/:id(.:format)))', via: :all
end
