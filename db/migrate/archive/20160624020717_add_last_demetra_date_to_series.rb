class AddLastDemetraDateToSeries < ActiveRecord::Migration
  def change
    add_column :series, :last_demetra_date, :date
  end
end
