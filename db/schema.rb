# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `rails
# db:schema:load`. When creating a new database, `rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 220170413025782) do

  create_table "api_applications", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.column "universe", "enum('UHERO','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.string "name"
    t.string "hostname"
    t.string "api_key"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "github_nickname"
    t.index ["universe", "name"], name: "index_api_applications_on_universe_and_name", unique: true
  end

  create_table "aremos_series", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
    t.string "name"
    t.string "frequency"
    t.string "description"
    t.string "start"
    t.string "end"
    t.text "data", size: :long
    t.text "aremos_data", size: :long
    t.date "aremos_update_date"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["name"], name: "index_aremos_series_on_name"
  end

  create_table "authorizations", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "provider", null: false
    t.integer "provider_user_id", null: false
    t.string "name"
    t.string "email"
    t.index ["provider_user_id"], name: "index_authorizations_on_provider_user_id"
    t.index ["user_id"], name: "fk_rails_4ecef5b8c5"
  end

  create_table "branch_code", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "last_branch_code_number", default: 0, null: false
  end

  create_table "categories", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
    t.integer "data_list_id"
    t.integer "default_geo_id"
    t.column "universe", "enum('UHERO','FC','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "hidden", default: false
    t.boolean "masked", default: false, null: false
    t.boolean "header", default: false
    t.integer "list_order"
    t.integer "order"
    t.string "name"
    t.string "ancestry"
    t.string "default_handle"
    t.column "default_freq", "enum('A','S','Q','M','W','D')"
    t.string "meta"
    t.string "description", limit: 500
    t.index ["ancestry"], name: "index_categories_on_ancestry"
    t.index ["data_list_id"], name: "fk_rails_cats_data_list_id"
    t.index ["default_geo_id"], name: "fk_rails_c390c9a75e"
    t.index ["name"], name: "index_categories_on_name", type: :fulltext
    t.index ["universe"], name: "index_categories_on_universe"
  end

  create_table "data_list_measurements", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "data_list_id"
    t.integer "measurement_id"
    t.integer "list_order", default: 0, null: false
    t.column "indent", "enum('indent0','indent1','indent2','indent3')", default: "indent0", null: false
    t.index ["data_list_id", "measurement_id"], name: "index_data_list_measurements_on_data_list_id_and_measurement_id", unique: true
    t.index ["data_list_id"], name: "index_data_list_measurements_on_data_list_id"
    t.index ["measurement_id"], name: "index_data_list_measurements_on_measurement_id"
  end

  create_table "data_lists", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.column "universe", "enum('UHERO','FC','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.string "name"
    t.integer "startyear"
    t.integer "endyear"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer "created_by"
    t.integer "updated_by"
    t.integer "owned_by"
    t.index ["universe"], name: "index_data_lists_on_universe"
  end

  create_table "data_lists_series", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "data_list_id", null: false
    t.integer "series_id", null: false
    t.index ["data_list_id"], name: "index_data_lists_series_on_data_list_id"
  end

  create_table "data_points", primary_key: ["xseries_id", "date", "created_at", "data_source_id"], options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
    t.integer "xseries_id", null: false
    t.date "date", null: false
    t.datetime "created_at", null: false
    t.integer "data_source_id", null: false
    t.boolean "current"
    t.float "value", limit: 53
    t.integer "pseudo_history", default: 0
    t.datetime "history"
    t.datetime "updated_at"
    t.float "change", limit: 53
    t.float "yoy", limit: 53
    t.float "ytd", limit: 53
    t.index ["data_source_id"], name: "index_on_data_source_id"
    t.index ["xseries_id", "current", "date"], name: "idx_data_points_xseries_current_date"
    t.index ["xseries_id", "updated_at"], name: "idx_data_points_xseries_updated"
  end

  create_table "data_source_actions", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "data_source_id"
    t.integer "series_id"
    t.integer "user_id"
    t.string "user_email"
    t.string "action"
    t.integer "priority"
    t.string "eval", limit: 500
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["series_id"], name: "fk_rails_cbe5366b13"
  end

  create_table "data_source_downloads", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "data_source_id"
    t.integer "download_id"
    t.datetime "last_file_vers_used", default: "1970-01-01 00:00:00", null: false
    t.string "last_eval_options_used", limit: 1000
    t.index ["data_source_id", "download_id"], name: "index_data_source_downloads_on_data_source_id_and_download_id", unique: true
  end

  create_table "data_sources", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
    t.integer "series_id"
    t.boolean "disabled", default: false, null: false
    t.column "universe", "enum('UHERO','FC','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.integer "priority", default: 100
    t.datetime "created_at"
    t.datetime "updated_at"
    t.boolean "reload_nightly", default: true
    t.boolean "pseudo_history", default: false, null: false
    t.boolean "clear_before_load", default: false, null: false
    t.string "eval", limit: 500
    t.string "scale", default: "1.0", null: false
    t.string "presave_hook"
    t.string "color"
    t.float "runtime"
    t.datetime "last_run_at"
    t.decimal "last_run_in_seconds", precision: 17, scale: 3
    t.string "last_error"
    t.datetime "last_error_at"
    t.text "dependencies"
    t.text "description"
    t.index ["dependencies"], name: "index_data_sources_on_dependencies", type: :fulltext
    t.index ["description"], name: "index_data_sources_on_description", type: :fulltext
    t.index ["series_id"], name: "index_data_sources_on_series_id"
    t.index ["universe"], name: "index_data_sources_on_universe"
  end

  create_table "dbedt_uploads", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.datetime "upload_at"
    t.boolean "active"
    t.column "cats_status", "enum('processing','ok','fail')"
    t.column "series_status", "enum('processing','ok','fail')"
    t.string "cats_filename"
    t.string "series_filename"
    t.string "last_error"
    t.datetime "last_error_at"
  end

  create_table "downloads", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.string "handle"
    t.integer "sort1"
    t.integer "sort2"
    t.string "url"
    t.column "filename_ext", "enum('xlsx','xls','zip','csv','txt','pdf')"
    t.text "post_parameters"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.datetime "last_download_at"
    t.datetime "last_change_at"
    t.boolean "date_sensitive", default: false, null: false
    t.boolean "freeze_file"
    t.string "file_to_extract"
    t.string "sheet_override"
    t.text "notes"
    t.index ["handle"], name: "index_downloads_on_handle", unique: true
  end

  create_table "dsd_log_entries", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
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

  create_table "dvw_uploads", options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.datetime "upload_at"
    t.boolean "active"
    t.column "cats_status", "enum('processing','ok','fail')"
    t.column "series_status", "enum('processing','ok','fail')"
    t.string "filename"
    t.string "last_error"
    t.datetime "last_error_at"
  end

  create_table "export_series", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "export_id"
    t.integer "series_id"
    t.integer "list_order"
    t.index ["export_id", "series_id"], name: "index_export_series_on_export_id_and_series_id", unique: true
    t.index ["export_id"], name: "index_export_series_on_export_id"
    t.index ["series_id"], name: "index_export_series_on_series_id"
  end

  create_table "exports", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.string "name"
    t.integer "created_by"
    t.integer "updated_by"
    t.integer "owned_by"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "feature_toggles", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.column "universe", "enum('UHERO','FC','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.string "name"
    t.string "description"
    t.boolean "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "forecast_snapshots", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.string "name"
    t.string "version"
    t.boolean "published"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "new_forecast_tsd_filename"
    t.string "new_forecast_tsd_label"
    t.string "old_forecast_tsd_filename"
    t.string "old_forecast_tsd_label"
    t.string "history_tsd_filename"
    t.string "history_tsd_label"
    t.text "comments"
    t.index ["name", "version"], name: "index_forecast_snapshots_on_name_and_version", unique: true
  end

  create_table "geo_trees", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "parent_id", null: false
    t.integer "child_id", null: false
    t.index ["child_id"], name: "fk_rails_5c6299c1f9"
    t.index ["parent_id"], name: "fk_rails_20ee9a0990"
  end

  create_table "geographies", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
    t.column "universe", "enum('UHERO','FC','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.string "handle"
    t.string "display_name"
    t.string "display_name_short"
    t.string "fips"
    t.integer "list_order"
    t.string "geotype"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["universe", "handle"], name: "index_geographies_on_universe_and_handle", unique: true
  end

  create_table "measurement_series", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "measurement_id"
    t.integer "series_id"
    t.index ["measurement_id", "series_id"], name: "index_measurement_series_on_measurement_id_and_series_id", unique: true
    t.index ["measurement_id"], name: "index_measurement_series_on_measurement_id"
    t.index ["series_id"], name: "index_measurement_series_on_series_id"
  end

  create_table "measurements", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "unit_id"
    t.integer "source_id"
    t.integer "source_detail_id"
    t.column "universe", "enum('UHERO','FC','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.string "prefix", null: false
    t.string "data_portal_name"
    t.string "table_prefix"
    t.string "table_postfix"
    t.string "frequency_transform"
    t.boolean "percent"
    t.boolean "real"
    t.integer "decimals", default: 1, null: false
    t.boolean "restricted", default: false, null: false
    t.boolean "seasonally_adjusted"
    t.column "seasonal_adjustment", "enum('seasonally_adjusted','not_seasonally_adjusted','not_applicable')"
    t.string "source_link"
    t.string "notes", limit: 500
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["source_detail_id"], name: "fk_rails_f4c727584e"
    t.index ["source_id"], name: "fk_rails_e96addabdb"
    t.index ["unit_id"], name: "fk_rails_c5bad45aff"
    t.index ["universe", "prefix"], name: "index_measurements_on_universe_and_prefix", unique: true
    t.index ["universe"], name: "index_measurements_on_universe"
  end

  create_table "new_dbedt_uploads", options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.datetime "upload_at"
    t.boolean "active"
    t.column "status", "enum('processing','ok','fail')"
    t.string "filename"
    t.datetime "last_error_at"
    t.string "last_error"
  end

  create_table "nta_uploads", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.datetime "upload_at"
    t.boolean "active"
    t.column "cats_status", "enum('processing','ok','fail')"
    t.column "series_status", "enum('processing','ok','fail')"
    t.string "series_filename"
    t.string "last_error"
    t.datetime "last_error_at"
  end

  create_table "packager_outputs", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
    t.string "path"
    t.date "last_new_data"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "public_data_points", primary_key: ["series_id", "date"], options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "series_id", null: false
    t.date "date", null: false
    t.float "value", limit: 53
    t.boolean "pseudo_history", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "reload_job_series", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.bigint "reload_job_id"
    t.bigint "series_id"
    t.index ["reload_job_id", "series_id"], name: "index_reload_job_series_on_reload_job_id_and_series_id", unique: true
    t.index ["reload_job_id"], name: "index_reload_job_series_on_reload_job_id"
    t.index ["series_id"], name: "index_reload_job_series_on_series_id"
  end

  create_table "reload_jobs", options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.bigint "user_id"
    t.datetime "created_at", null: false
    t.column "status", "enum('processing','done','fail')"
    t.datetime "finished_at"
    t.string "params"
    t.boolean "update_public", default: false, null: false
    t.string "error"
    t.index ["user_id"], name: "index_reload_jobs_on_user_id"
  end

  create_table "series", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
    t.integer "xseries_id", null: false
    t.integer "geography_id"
    t.integer "unit_id"
    t.integer "source_id"
    t.integer "source_detail_id"
    t.column "universe", "enum('UHERO','FC','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.integer "decimals", default: 1, null: false
    t.string "name"
    t.string "dataPortalName"
    t.string "description", limit: 500
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer "dependency_depth", default: 0
    t.string "source_link"
    t.string "investigation_notes", limit: 500
    t.integer "scratch", default: 0, null: false
    t.index ["geography_id"], name: "fk_rails_963076a967"
    t.index ["name", "dataPortalName"], name: "name_data_portal_name_description", type: :fulltext
    t.index ["name"], name: "index_series_on_name"
    t.index ["source_detail_id"], name: "fk_rails_36c9ba7209"
    t.index ["source_id"], name: "fk_rails_6f2f66e327"
    t.index ["unit_id"], name: "fk_rails_1961e72b74"
    t.index ["universe", "name"], name: "index_series_on_universe_and_name", unique: true
    t.index ["universe", "xseries_id", "id"], name: "series_univ_x_id"
    t.index ["universe", "xseries_id"], name: "index_series_on_universe_and_xseries_id", unique: true
    t.index ["universe"], name: "index_series_on_universe"
    t.index ["xseries_id"], name: "fk_rails_b3202f6d25"
  end

  create_table "series_reload_logs", primary_key: ["batch_id", "series_id"], options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.string "batch_id", null: false
    t.integer "series_id", null: false
    t.integer "depth"
    t.string "job_id"
    t.string "status"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "source_details", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.column "universe", "enum('UHERO','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "description", limit: 1000
    t.index ["universe"], name: "index_source_details_on_universe"
  end

  create_table "sources", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.column "universe", "enum('UHERO','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.string "description"
    t.string "link"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["universe"], name: "index_sources_on_universe"
  end

  create_table "tsd_files", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.integer "forecast_snapshot_id"
    t.string "filename"
    t.boolean "latest_forecast"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "units", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.column "universe", "enum('UHERO','FC','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.string "short_label"
    t.string "long_label"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["universe", "short_label", "long_label"], name: "index_units_on_universe_and_short_label_and_long_label", unique: true
  end

  create_table "user_series", id: false, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.bigint "user_id"
    t.bigint "series_id"
    t.index ["series_id"], name: "index_user_series_on_series_id"
    t.index ["user_id", "series_id"], name: "index_user_series_on_user_id_and_series_id", unique: true
    t.index ["user_id"], name: "index_user_series_on_user_id"
  end

  create_table "users", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci", force: :cascade do |t|
    t.column "universe", "enum('UHERO','DBEDT','NTA','COH','CCOM')", default: "UHERO", null: false
    t.column "role", "enum('external','fsonly','internal','admin','dev')", default: "external", null: false
    t.boolean "mnemo_search", default: false, null: false
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

  create_table "xseries", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci", force: :cascade do |t|
    t.integer "primary_series_id"
    t.boolean "restricted", default: false, null: false
    t.boolean "quarantined", default: false
    t.string "frequency"
    t.boolean "seasonally_adjusted"
    t.column "seasonal_adjustment", "enum('seasonally_adjusted','not_seasonally_adjusted','not_applicable')"
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
    t.date "last_demetra_date"
    t.string "last_demetra_datestring"
    t.string "factor_application"
    t.text "factors"
    t.index ["primary_series_id"], name: "fk_rails_4d09425f97"
    t.index ["quarantined", "id"], name: "xseries_quar_id"
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
