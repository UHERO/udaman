class AddDependencyDepthToSeries < ActiveRecord::Migration
  def self.up
    add_column :series, :dependency_depth, :integer
  end

  def self.down
    remove_column :series, :dependency_depth
  end
end
