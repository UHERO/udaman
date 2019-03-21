class CreateSeriesx < ActiveRecord::Migration[5.2]
  def self.up
    execute <<~SQL
      CREATE TABLE seriesx LIKE series;
    SQL
    add_column :data_points, :seriesx_id, :integer, null: false, default: 0, after: :series_id
    add_column :public_data_points, :seriesx_id, :integer, null: false, default: 0, after: :series_id
    remove_column :data_points, :id
    remove_column :data_points, :universe
  end

  def self.down
    drop_table :seriesx if table_exists? :seriesx
    remove_column :data_points, :seriesx_id if column_exists? :data_points, :seriesx_id
    remove_column :public_data_points, :seriesx_id if column_exists? :public_data_points, :seriesx_id
  end
end
