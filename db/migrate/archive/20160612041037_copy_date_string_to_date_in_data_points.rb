class CopyDateStringToDateInDataPoints < [5.2]
  def change
    DataPoint.update_all 'date = date_string'
  end
end
