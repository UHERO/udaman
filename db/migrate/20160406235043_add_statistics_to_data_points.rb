class AddStatisticsToDataPoints < ActiveRecord::Migration
  def self.up
    add_column :data_points, :change, :float, :limit => 53
    add_column :data_points, :yoy, :float, :limit => 53
    add_column :data_points, :ytd, :float, :limit => 53
  end

  def self.down
    remove_column :data_points, :change
    remove_column :data_points, :yoy
    remove_column :data_points, :ytd
  end
end
