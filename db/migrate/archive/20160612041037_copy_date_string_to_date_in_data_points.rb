class CopyDateStringToDateInDataPoints < ActiveRecord::Migration
  def change
    DataPoint.update_all 'date = date_string'
  end
end
