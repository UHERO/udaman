module SeriesDataAdjustment
  def first_value_date
    self.data.sort.each do |date, value|
      return date unless value.nil?
    end
    nil
  end
     
  def last_value_date
    self.data.sort.reverse.each do |date, value|
      return date unless value.nil?
    end
    nil
  end
       
  def trim(start_date = get_last_incomplete_january, end_date = Time.now.to_date.to_s)
    new_series_data = get_values_after_including(start_date, end_date)
    new_transformation("Trimmed #{name} starting at #{start_date}", new_series_data)
  end

  def get_last_incomplete_january
    last_date = (self.data.reject {|_, val| val.nil?}).keys.sort[-1]
    #BT 2013-02-13 Changing the code to just always give the most recent january. regardless of whether the year is complete or not. Not sure if this will screw
    #up other things, but seems like it should work in more cases
    #return last_date[5..6] == "12" ? "#{last_date[0..3].to_i + 1}-01-01" : "#{last_date[0..3].to_i}-01-01"
    #Additional note after running on TAX_IDENTITIES it looks like this doesn't break anything, but has results that get overwritten so there are temporary mismatches. But generally looks ok
    Date.new(last_date.year)
  end
  
  def get_last_complete_december
    last_date = self.data.keys.sort[-1]
    Date.new(last_date.year, 12)
  end
  
  def get_last_complete_4th_quarter
    last_date = self.data.keys.sort[-1]
    Date.new(last_date.year, 10)
  end
  
  def get_last_incomplete_year
    last_date = self.data.keys.sort[-1]
    if (last_date.month == 12 and frequency == 'month') or (last_date.month == 10 and frequency == 'quarter')
      new_series_data = {} 
      return new_transformation('No Data since no incomplete year', new_series_data)
    end
    start_date = "#{last_date.year}-01-01"
    end_date = Time.now.to_date.to_s
    trim(start_date, end_date)
  end
  
  def get_values_after(start_date, end_date = data.keys.sort[-1])
    data.reject {|date, value| date <= start_date or value.nil? or date > end_date}
  end
  
  def get_values_after_including(start_date, end_date = data.keys.sort[-1])
    data.reject {|date, value| date < start_date or value.nil? or date > end_date}
  end

  def get_scaled_no_ph_after_inc(start_data, end_data = Time.now.to_date, round_to = 3)
    scaled_data_no_pseudo_history(round_to).reject {|date, value| date < start_data or value.nil? or date > end_data}
  end
  
  def compressed_date_range_data(compressed_dates = Date.compressed_date_range)
    compressed_date_range_data = {}
    compressed_dates.each { |date| compressed_date_range_data[date] = data[date] }
    compressed_date_range_data
  end
  
  def get_data_for_month(month_num)
    return {} if month_num > 12 or month_num < 1
    month_prefix = %w(01 02 03 04 05 06 07 08 09 10 11 12)[month_num-1]
    data.reject {|date_string, _| date_string.month != month_prefix}
  end
  
  def shift_forward_months(num_months)
    new_series_data = Hash[data.map {|date, val| [(Date.parse(date) >> num_months).to_s, val]}]
    new_transformation("Shifted Series #{name} forward by #{num_months} months ", new_series_data)
  end

  def shift_backward_months(num_months)
    new_series_data = Hash[data.map {|date, val| [(Date.parse(date) << num_months).to_s, val]}]
    new_transformation("Shifted Series #{name} backwards by #{num_months} months ", new_series_data)
  end

  
  def shift_forward_years(num_years)
    new_series_data = Hash[data.map {|date, val| [(Date.parse(date) >> 12 * num_years).to_s, val]}]
    new_transformation("Shifted Series #{name}", new_series_data)
  end
end
