class AddDependencyDepthToSeries < ActiveRecord::Migration
  def self.up
    add_column :series, :dependency_depth, :integer unless column_exists? :series, :dependency_depth
  end

  def self.down
    remove_column :series, :dependency_depth if column_exists? :series, :dependency_depth
  end
end
