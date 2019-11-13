# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 220170413025755) do

  create_table "api_applications", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "name"
    t.string "hostname"
    t.string "api_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "github_nickname"
    t.index ["universe", "name"], name: "index_api_applications_on_universe_and_name", unique: true
  end

  create_table "aremos_series", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "name"
    t.string "frequency"
    t.string "description"
    t.string "start"
    t.string "end"
    t.text "data", limit: 4294967295
    t.text "aremos_data", limit: 4294967295
    t.date "aremos_update_date"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["name"], name: "index_aremos_series_on_name"
  end

  create_table "authorizations", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "provider", null: false
    t.integer "provider_user_id", null: false
    t.string "name"
    t.string "email"
    t.index ["provider_user_id"], name: "index_authorizations_on_provider_user_id"
    t.index ["user_id"], name: "fk_rails_4ecef5b8c5"
  end

  create_table "categories", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "name"
    t.integer "data_list_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "hidden", default: false
    t.boolean "masked", default: false, null: false
    t.boolean "header", default: false
    t.integer "list_order"
    t.integer "order"
    t.string "ancestry"
    t.integer "default_geo_id"
    t.string "default_handle"
    t.string "default_freq", limit: 1
    t.string "meta"
    t.index ["ancestry"], name: "index_categories_on_ancestry"
    t.index ["data_list_id"], name: "fk_rails_cats_data_list_id"
    t.index ["default_geo_id"], name: "fk_rails_c390c9a75e"
    t.index ["name"], name: "index_categories_on_name", type: :fulltext
    t.index ["universe"], name: "index_categories_on_universe"
  end

  create_table "data_list_measurements", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "data_list_id"
    t.integer "measurement_id"
    t.integer "list_order", default: 0, null: false
    t.string "indent", limit: 7, default: "indent0", null: false
    t.index ["data_list_id", "measurement_id"], name: "index_data_list_measurements_on_data_list_id_and_measurement_id", unique: true
    t.index ["data_list_id"], name: "index_data_list_measurements_on_data_list_id"
    t.index ["measurement_id"], name: "index_data_list_measurements_on_measurement_id"
  end

  create_table "data_lists", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "name"
    t.text "list"
    t.integer "startyear"
    t.integer "endyear"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer "created_by"
    t.integer "updated_by"
    t.integer "owned_by"
    t.index ["universe"], name: "index_data_lists_on_universe"
  end

  create_table "data_lists_series", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "data_list_id", null: false
    t.integer "series_id", null: false
    t.index ["data_list_id"], name: "index_data_lists_series_on_data_list_id"
  end

  create_table "data_load_patterns", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "start_date"
    t.string "frequency"
    t.string "path"
    t.string "worksheet"
    t.string "row"
    t.string "col"
    t.string "last_date_read"
    t.string "last_read_status"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.boolean "reverse", default: false
  end

  create_table "data_points", primary_key: ["xseries_id", "date", "created_at", "data_source_id"], options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.integer "xseries_id", null: false
    t.date "date", null: false
    t.boolean "current"
    t.float "value", limit: 53
    t.integer "data_source_id", null: false
    t.datetime "history"
    t.datetime "created_at", null: false
    t.datetime "updated_at"
    t.boolean "pseudo_history", default: false
    t.float "change", limit: 53
    t.float "yoy", limit: 53
    t.float "ytd", limit: 53
  end

  create_table "data_portal_names", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "prefix"
    t.string "units"
    t.string "data_portal_name"
  end

  create_table "data_source_actions", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "series_id"
    t.integer "user_id"
    t.string "user_email"
    t.integer "data_source_id"
    t.string "action"
    t.text "eval"
    t.integer "priority"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["series_id"], name: "fk_rails_cbe5366b13"
  end

  create_table "data_source_downloads", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "data_source_id"
    t.integer "download_id"
    t.datetime "last_file_vers_used", default: "1970-01-01 00:00:00", null: false
    t.string "last_eval_options_used", limit: 1000
    t.index ["data_source_id", "download_id"], name: "index_data_source_downloads_on_data_source_id_and_download_id", unique: true
  end

  create_table "data_sources", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.integer "series_id"
    t.text "description"
    t.text "eval"
    t.text "dependencies"
    t.string "color"
    t.float "runtime"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.boolean "reload_nightly", default: true
    t.datetime "last_run_at"
    t.decimal "last_run_in_seconds", precision: 17, scale: 3
    t.string "last_error"
    t.datetime "last_error_at"
    t.integer "priority", default: 100
    t.index ["dependencies"], name: "index_data_sources_on_dependencies", type: :fulltext
    t.index ["description"], name: "index_data_sources_on_description", type: :fulltext
    t.index ["eval"], name: "index_data_sources_on_eval", type: :fulltext
    t.index ["series_id"], name: "index_data_sources_on_series_id"
    t.index ["universe"], name: "index_data_sources_on_universe"
  end

  create_table "dbedt_uploads", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.datetime "upload_at"
    t.boolean "active"
    t.string "cats_status", limit: 10
    t.string "series_status", limit: 10
    t.string "cats_filename"
    t.string "series_filename"
    t.string "last_error"
    t.datetime "last_error_at"
  end

  create_table "downloads", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "handle"
    t.string "url"
    t.string "filename_ext", limit: 4
    t.text "post_parameters"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.datetime "last_download_at"
    t.datetime "last_change_at"
    t.boolean "freeze_file"
    t.string "file_to_extract"
    t.string "sheet_override"
    t.text "notes"
  end

  create_table "dsd_log_entries", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.integer "download_id"
    t.datetime "time"
    t.string "url"
    t.string "location"
    t.integer "status"
    t.boolean "dl_changed"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string "mimetype"
  end

  create_table "dvw_uploads", options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.datetime "upload_at"
    t.boolean "active"
    t.string "cats_status", limit: 10
    t.string "series_status", limit: 10
    t.string "filename"
    t.string "last_error"
    t.datetime "last_error_at"
  end

  create_table "export_series", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "export_id"
    t.integer "series_id"
    t.integer "list_order"
    t.index ["export_id", "series_id"], name: "index_export_series_on_export_id_and_series_id", unique: true
    t.index ["export_id"], name: "index_export_series_on_export_id"
    t.index ["series_id"], name: "index_export_series_on_series_id"
  end

  create_table "exports", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "name"
    t.integer "created_by"
    t.integer "updated_by"
    t.integer "owned_by"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "feature_toggles", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "name"
    t.string "description"
    t.boolean "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "forecast_snapshots", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "name"
    t.string "version"
    t.text "comments"
    t.boolean "published"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "new_forecast_tsd_filename"
    t.string "new_forecast_tsd_label"
    t.string "old_forecast_tsd_filename"
    t.string "old_forecast_tsd_label"
    t.string "history_tsd_filename"
    t.string "history_tsd_label"
  end

  create_table "geo_trees", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "parent_id", null: false
    t.integer "child_id", null: false
    t.index ["child_id"], name: "fk_rails_5c6299c1f9"
    t.index ["parent_id"], name: "fk_rails_20ee9a0990"
  end

  create_table "geographies", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "fips"
    t.string "display_name"
    t.string "display_name_short"
    t.string "handle"
    t.string "geotype"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["universe", "handle"], name: "index_geographies_on_universe_and_handle", unique: true
  end

  create_table "measurement_series", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "measurement_id"
    t.integer "series_id"
    t.index ["measurement_id", "series_id"], name: "index_measurement_series_on_measurement_id_and_series_id", unique: true
    t.index ["measurement_id"], name: "index_measurement_series_on_measurement_id"
    t.index ["series_id"], name: "index_measurement_series_on_series_id"
  end

  create_table "measurements", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "prefix", null: false
    t.string "data_portal_name"
    t.string "table_prefix"
    t.string "table_postfix"
    t.string "frequency_transform"
    t.integer "unit_id"
    t.boolean "percent"
    t.boolean "real"
    t.integer "decimals", default: 2, null: false
    t.boolean "restricted", default: false, null: false
    t.boolean "seasonally_adjusted"
    t.string "seasonal_adjustment", limit: 23
    t.integer "source_detail_id"
    t.integer "source_id"
    t.string "source_link"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["source_detail_id"], name: "fk_rails_f4c727584e"
    t.index ["source_id"], name: "fk_rails_e96addabdb"
    t.index ["unit_id"], name: "fk_rails_c5bad45aff"
    t.index ["universe"], name: "index_measurements_on_universe"
  end

  create_table "nta_uploads", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.datetime "upload_at"
    t.boolean "active"
    t.string "cats_status", limit: 10
    t.string "series_status", limit: 10
    t.string "series_filename"
    t.string "last_error"
    t.datetime "last_error_at"
  end

  create_table "packager_outputs", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "path"
    t.date "last_new_data"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "public_data_points", primary_key: ["series_id", "date"], options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe_ob", limit: 8, default: "UHERO", null: false
    t.integer "series_id", null: false
    t.date "date", null: false
    t.float "value", limit: 53
    t.boolean "pseudo_history", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["universe_ob"], name: "index_public_data_points_on_universe_ob"
  end

  create_table "series", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.integer "xseries_id", null: false
    t.string "name"
    t.string "dataPortalName"
    t.text "description"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.text "investigation_notes"
    t.integer "dependency_depth"
    t.integer "unit_id"
    t.integer "geography_id"
    t.integer "decimals", default: 2, null: false
    t.integer "source_id"
    t.string "source_link"
    t.integer "source_detail_id"
    t.integer "scratch", default: 0, null: false
    t.index ["geography_id"], name: "fk_rails_963076a967"
    t.index ["name", "dataPortalName", "description"], name: "name_data_portal_name_description", type: :fulltext
    t.index ["name"], name: "index_series_on_name"
    t.index ["source_detail_id"], name: "fk_rails_36c9ba7209"
    t.index ["source_id"], name: "fk_rails_6f2f66e327"
    t.index ["unit_id"], name: "fk_rails_1961e72b74"
    t.index ["universe", "xseries_id"], name: "index_series_on_universe_and_xseries_id", unique: true
    t.index ["universe"], name: "index_series_on_universe"
    t.index ["xseries_id"], name: "fk_rails_b3202f6d25"
  end

  create_table "series_reload_logs", primary_key: ["batch_id", "series_id"], options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "batch_id", null: false
    t.integer "series_id", null: false
    t.integer "depth"
    t.string "job_id"
    t.string "status"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "source_details", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["universe"], name: "index_source_details_on_universe"
  end

  create_table "sources", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "description"
    t.string "link"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["universe"], name: "index_sources_on_universe"
  end

  create_table "transformations", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "key"
    t.string "description"
    t.string "formula"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "tsd_files", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.integer "forecast_snapshot_id"
    t.string "filename"
    t.boolean "latest_forecast"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "units", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "short_label"
    t.string "long_label"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["universe", "short_label", "long_label"], name: "index_units_on_universe_and_short_label_and_long_label", unique: true
  end

  create_table "user_feedbacks", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "name"
    t.string "email"
    t.text "feedback"
    t.text "notes"
    t.boolean "resolved"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "users", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
    t.string "universe", limit: 5, default: "UHERO", null: false
    t.string "role", limit: 8, default: "external", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", limit: 128, default: "", null: false
    t.string "password_salt", default: ""
    t.string "reset_password_token"
    t.string "remember_token"
    t.datetime "remember_created_at"
    t.integer "sign_in_count", default: 0
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "last_sign_in_ip"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.datetime "reset_password_sent_at"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["universe"], name: "index_users_on_universe"
  end

  create_table "xseries", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8", force: :cascade do |t|
    t.integer "primary_series_id"
    t.string "frequency"
    t.boolean "seasonally_adjusted"
    t.string "seasonal_adjustment", limit: 23
    t.string "last_demetra_datestring"
    t.date "last_demetra_date"
    t.text "factors"
    t.string "factor_application"
    t.integer "aremos_missing"
    t.float "aremos_diff"
    t.integer "mult"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer "units", default: 1, null: false
    t.boolean "percent"
    t.boolean "real"
    t.integer "base_year"
    t.string "frequency_transform"
    t.boolean "restricted", default: false, null: false
    t.boolean "quarantined", default: false
    t.index ["primary_series_id"], name: "fk_rails_4d09425f97"
  end

  add_foreign_key "authorizations", "users"
  add_foreign_key "categories", "data_lists", name: "fk_rails_cats_data_list_id"
  add_foreign_key "categories", "geographies", column: "default_geo_id"
  add_foreign_key "data_source_actions", "series"
  add_foreign_key "geo_trees", "geographies", column: "child_id"
  add_foreign_key "geo_trees", "geographies", column: "parent_id"
  add_foreign_key "measurements", "source_details"
  add_foreign_key "measurements", "sources"
  add_foreign_key "measurements", "units"
  add_foreign_key "series", "geographies"
  add_foreign_key "series", "source_details"
  add_foreign_key "series", "sources"
  add_foreign_key "series", "units"
  add_foreign_key "series", "xseries"
  add_foreign_key "xseries", "series", column: "primary_series_id"
end
