class AddPseudohistory < ActiveRecord::Migration
  def self.up
    add_column :data_points, :pseudo_history, :boolean, :default => false unless column_exists? :data_points, :pseudo_history
  end

  def self.down
    remove_column :data_points, :pseudo_history if column_exists? :data_points, :pseudo_history
  end
  
end
