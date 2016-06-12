class AddDateToDataPoints < ActiveRecord::Migration
  def change
    add_column :data_points, :date, :date
  end
end
