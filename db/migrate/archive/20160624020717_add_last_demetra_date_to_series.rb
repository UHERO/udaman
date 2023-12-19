class AddLastDemetraDateToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :last_demetra_date, :date
  end
end
