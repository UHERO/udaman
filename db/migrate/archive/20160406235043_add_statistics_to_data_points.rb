class AddStatisticsToDataPoints < ActiveRecord::Migration
  def self.up
    add_column :data_points, :change, :float, :limit => 53 unless column_exists? :data_points, :change
    add_column :data_points, :yoy, :float, :limit => 53 unless column_exists? :data_points, :yoy
    add_column :data_points, :ytd, :float, :limit => 53 unless column_exists? :data_points, :ytd
  end

  def self.down
    remove_column :data_points, :change if column_exists? :data_points, :change
    remove_column :data_points, :yoy if column_exists? :data_points, :yoy
    remove_column :data_points, :ytd if column_exists? :data_points, :ytd
  end
end
