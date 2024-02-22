class AddDateToDataPoints < ActiveRecord::Migration[5.2]
  def change
    add_column :data_points, :date, :date
  end
end
