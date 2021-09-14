class CreateMiscStuff < ActiveRecord::Migration[5.2]
  def change
    drop table :data_load_patterns
    drop table :data_portal_names

    create_table :last_branch_code do |t|
      t.integer :last_branch_code_number, null: false, default: 0
    end

  end
end
