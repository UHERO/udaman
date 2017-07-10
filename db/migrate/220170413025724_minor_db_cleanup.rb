class MinorDbCleanup < ActiveRecord::Migration
  def change
    change_column :categories, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO'
    remove_column :sources, :source_type
  end
end
