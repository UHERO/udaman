# encoding: UTF-8
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

ActiveRecord::Schema.define(version: 20161221234459) do

  create_table "api_applications", force: :cascade do |t|
    t.string   "name",            limit: 255
    t.string   "hostname",        limit: 255
    t.string   "api_key",         limit: 255
    t.datetime "created_at",                  null: false
    t.datetime "updated_at",                  null: false
    t.string   "github_nickname", limit: 255
  end

  create_table "aremos_series", force: :cascade do |t|
    t.string   "name",               limit: 255
    t.string   "frequency",          limit: 255
    t.string   "description",        limit: 255
    t.string   "start",              limit: 255
    t.string   "end",                limit: 255
    t.text     "data",               limit: 4294967295
    t.text     "aremos_data",        limit: 4294967295
    t.date     "aremos_update_date"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  add_index "aremos_series", ["name"], name: "index_aremos_series_on_name", using: :btree

  create_table "authorizations", id: false, force: :cascade do |t|
    t.integer "user_id",          limit: 4,   null: false
    t.string  "provider",         limit: 255, null: false
    t.integer "provider_user_id", limit: 4,   null: false
    t.string  "name",             limit: 255
    t.string  "email",            limit: 255
  end

  add_index "authorizations", ["provider_user_id"], name: "index_authorizations_on_provider_user_id", using: :btree
  add_index "authorizations", ["user_id"], name: "fk_rails_4ecef5b8c5", using: :btree

  create_table "categories", force: :cascade do |t|
    t.string   "name",           limit: 255
    t.integer  "data_list_id",   limit: 4
    t.datetime "created_at",                 null: false
    t.datetime "updated_at",                 null: false
    t.integer  "order",          limit: 4
    t.string   "ancestry",       limit: 255
    t.string   "default_handle", limit: 255
    t.string   "default_freq",   limit: 255
  end

  add_index "categories", ["ancestry"], name: "index_categories_on_ancestry", using: :btree

  create_table "data_list_measurements", force: :cascade do |t|
    t.integer "data_list_id",   limit: 4
    t.integer "measurement_id", limit: 4
    t.integer "list_order",     limit: 4
  end

  add_index "data_list_measurements", ["data_list_id", "measurement_id"], name: "index_data_list_measurements_on_data_list_id_and_measurement_id", unique: true, using: :btree
  add_index "data_list_measurements", ["data_list_id"], name: "index_data_list_measurements_on_data_list_id", using: :btree
  add_index "data_list_measurements", ["measurement_id"], name: "index_data_list_measurements_on_measurement_id", using: :btree

  create_table "data_lists", force: :cascade do |t|
    t.string   "name",       limit: 255
    t.text     "list",       limit: 65535
    t.integer  "startyear",  limit: 4
    t.integer  "endyear",    limit: 4
    t.string   "startdate",  limit: 255
    t.string   "enddate",    limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "created_by", limit: 4
    t.integer  "updated_by", limit: 4
    t.integer  "owned_by",   limit: 4
  end

  create_table "data_lists_series", id: false, force: :cascade do |t|
    t.integer "data_list_id", limit: 4, null: false
    t.integer "series_id",    limit: 4, null: false
  end

  add_index "data_lists_series", ["data_list_id"], name: "index_data_lists_series_on_data_list_id", using: :btree

  create_table "data_load_patterns", force: :cascade do |t|
    t.string   "start_date",       limit: 255
    t.string   "frequency",        limit: 255
    t.string   "path",             limit: 255
    t.string   "worksheet",        limit: 255
    t.string   "row",              limit: 255
    t.string   "col",              limit: 255
    t.string   "last_date_read",   limit: 255
    t.string   "last_read_status", limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.boolean  "reverse",                      default: false
  end

  create_table "data_points", id: false, force: :cascade do |t|
    t.integer  "id",              limit: 4,  default: 0,     null: false
    t.integer  "series_id",       limit: 4,                  null: false
    t.float    "value",           limit: 53
    t.boolean  "current"
    t.integer  "data_source_id",  limit: 4,                  null: false
    t.datetime "history"
    t.datetime "created_at",                                 null: false
    t.datetime "updated_at"
    t.integer  "restore_counter", limit: 4,  default: 0
    t.boolean  "pseudo_history",             default: false
    t.float    "change",          limit: 53
    t.float    "yoy",             limit: 53
    t.float    "ytd",             limit: 53
    t.date     "date",                                       null: false
  end

  create_table "data_portal_names", id: false, force: :cascade do |t|
    t.string "prefix",           limit: 255
    t.string "units",            limit: 255
    t.string "data_portal_name", limit: 255
  end

  create_table "data_source_downloads", force: :cascade do |t|
    t.string   "url",             limit: 255
    t.text     "post_parameters", limit: 65535
    t.string   "save_path",       limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "handle",          limit: 255
    t.string   "file_to_extract", limit: 255
    t.text     "notes",           limit: 65535
  end

  create_table "data_sources", force: :cascade do |t|
    t.integer  "series_id",           limit: 4
    t.text     "description",         limit: 65535
    t.text     "eval",                limit: 65535
    t.text     "dependencies",        limit: 65535
    t.string   "color",               limit: 255
    t.float    "runtime",             limit: 24
    t.datetime "created_at"
    t.datetime "updated_at"
    t.decimal  "last_run_in_seconds",               precision: 17, scale: 3
    t.integer  "priority",            limit: 4,                              default: 100
  end

  add_index "data_sources", ["series_id"], name: "index_data_sources_on_series_id", using: :btree

  create_table "dsd_log_entries", force: :cascade do |t|
    t.integer  "data_source_download_id", limit: 4
    t.datetime "time"
    t.string   "url",                     limit: 255
    t.string   "location",                limit: 255
    t.integer  "status",                  limit: 4
    t.boolean  "dl_changed"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "mimetype",                limit: 255
  end

  create_table "exports", force: :cascade do |t|
    t.string   "name",       limit: 255
    t.integer  "created_by", limit: 4
    t.integer  "updated_by", limit: 4
    t.integer  "owned_by",   limit: 4
    t.datetime "created_at",             null: false
    t.datetime "updated_at",             null: false
  end

  create_table "geographies", force: :cascade do |t|
    t.string   "fips",               limit: 255
    t.string   "display_name",       limit: 255
    t.string   "display_name_short", limit: 255
    t.string   "handle",             limit: 255
    t.datetime "created_at",                     null: false
    t.datetime "updated_at",                     null: false
  end

  create_table "measurements", force: :cascade do |t|
    t.string   "prefix",            limit: 255,   null: false
    t.string   "data_portal_name",  limit: 255
    t.string   "units_label",       limit: 255
    t.string   "units_label_short", limit: 255
    t.boolean  "percent"
    t.boolean  "real"
    t.text     "notes",             limit: 65535
    t.datetime "created_at",                      null: false
    t.datetime "updated_at",                      null: false
  end

  create_table "packager_outputs", force: :cascade do |t|
    t.string   "path",          limit: 255
    t.date     "last_new_data"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "prognoz_data_files", force: :cascade do |t|
    t.string   "name",              limit: 255
    t.string   "filename",          limit: 255
    t.string   "frequency",         limit: 255
    t.text     "series_loaded",     limit: 4294967295
    t.text     "series_covered",    limit: 65535
    t.text     "series_validated",  limit: 65535
    t.text     "output_series",     limit: 65535
    t.string   "output_start_date", limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "series", force: :cascade do |t|
    t.string   "name",                    limit: 255
    t.string   "frequency",               limit: 255
    t.string   "description",             limit: 255
    t.integer  "units",                   limit: 4
    t.boolean  "seasonally_adjusted"
    t.string   "last_demetra_datestring", limit: 255
    t.text     "factors",                 limit: 65535
    t.string   "factor_application",      limit: 255
    t.string   "prognoz_data_file_id",    limit: 255
    t.integer  "aremos_missing",          limit: 4
    t.float    "aremos_diff",             limit: 24
    t.integer  "mult",                    limit: 4
    t.datetime "created_at"
    t.datetime "updated_at"
    t.text     "investigation_notes",     limit: 65535
    t.integer  "dependency_depth",        limit: 4
    t.date     "last_demetra_date"
    t.string   "unitsLabel",              limit: 255
    t.string   "unitsLabelShort",         limit: 255
    t.string   "dataPortalName",          limit: 255
    t.boolean  "percent"
    t.boolean  "real"
    t.string   "frequency_transform",     limit: 255
    t.integer  "measurement_id",          limit: 4
  end

  add_index "series", ["measurement_id"], name: "fk_rails_3e7bc49267", using: :btree
  add_index "series", ["name", "dataPortalName", "description"], name: "name_data_portal_name_description", type: :fulltext
  add_index "series", ["name"], name: "index_series_on_name", unique: true, using: :btree

  create_table "sources", force: :cascade do |t|
    t.string   "description", limit: 255
    t.string   "link",        limit: 255
    t.datetime "created_at",              null: false
    t.datetime "updated_at",              null: false
  end

  create_table "transformations", force: :cascade do |t|
    t.string   "key",         limit: 255
    t.string   "description", limit: 255
    t.string   "formula",     limit: 255
    t.datetime "created_at",              null: false
    t.datetime "updated_at",              null: false
  end

  create_table "users", force: :cascade do |t|
    t.string   "email",                  limit: 255, default: "", null: false
    t.string   "encrypted_password",     limit: 128, default: "", null: false
    t.string   "password_salt",          limit: 255, default: "", null: false
    t.string   "reset_password_token",   limit: 255
    t.string   "remember_token",         limit: 255
    t.datetime "remember_created_at"
    t.integer  "sign_in_count",          limit: 4,   default: 0
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string   "current_sign_in_ip",     limit: 255
    t.string   "last_sign_in_ip",        limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.datetime "reset_password_sent_at"
    t.string   "role",                   limit: 16
  end

  add_index "users", ["email"], name: "index_users_on_email", unique: true, using: :btree
  add_index "users", ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true, using: :btree

  add_foreign_key "authorizations", "users"
  add_foreign_key "series", "measurements"
end
