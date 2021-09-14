class CreateMiscStuff < ActiveRecord::Migration[5.2]
  def change
    drop table :data_load_patterns
    drop table :data_portal_names
    drop table :tsd_files

    create_table :last_branch_code do |t|
      t.integer :last_branch_code_number, null: false, default: 0
    end

  end
end
