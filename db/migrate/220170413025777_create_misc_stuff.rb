class CreateMiscStuff < ActiveRecord::Migration[5.2]
  def change
    drop_table :data_load_patterns
    drop_table :data_portal_names
    drop_table :tsd_files

    create_table :branch_code do |t|
      t.integer :last_branch_code_number, null: false, default: 0
    end
  end
end
