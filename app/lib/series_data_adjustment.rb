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

  def trim(start_date = nil, end_date = nil)
    ## more flexibility to allow either or both parameters to be passed as nil and assign defaults within
    start_date ||= (self.trim_period_start || get_last_incomplete_january)
    end_date ||= (self.trim_period_end || Time.now.to_date)
    if start_date.nil?
      return new_transformation("Trimmed #{name}", data)
    end
    new_series_data = get_values_after_including(start_date.to_date, end_date.to_date)
    new_name = start_date == '1000-01-01' ? name : "Trimmed #{name} starting at #{start_date}"
    new_transformation(new_name, new_series_data)
  end

  def no_trim_past
    self.tap {|o| o.trim_period_start = '1000-01-01' }
  end

  def no_trim_future
    self.tap {|o| o.trim_period_end = '2999-12-31' }
  end

  def no_trim
    no_trim_past
    no_trim_future
  end

  def get_last_incomplete_january
    last_date = self.last_observation
    return nil if last_date.nil?
    #BT 2013-02-13 Changing the code to just always give the most recent january. regardless of whether the year is complete or not. Not sure if this will screw
    #up other things, but seems like it should work in more cases
    #return last_date[5..6] == "12" ? "#{last_date[0..3].to_i + 1}-01-01" : "#{last_date[0..3].to_i}-01-01"
    #Additional note after running on TAX_IDENTITIES it looks like this doesn't break anything, but has results that get overwritten so there are temporary mismatches. But generally looks ok
    Date.new(last_date.year)
  end
  
  def get_last_complete_december
    last_date = self.last_observation
    return nil if last_date.nil?
    last_date.month == 12 ? last_date : Date.new(last_date.year - 1, 12)
  end
  
  def get_last_complete_4th_quarter
    last_date = self.last_observation
    return nil if last_date.nil?
    last_date.month == 10 ? last_date : Date.new(last_date.year - 1, 10)
  end
  
  def get_last_incomplete_year(start_date = nil)
    last_date = self.last_observation
    return nil if last_date.nil?
    if (frequency == 'month' && last_date.month == 12) || (frequency == 'quarter' && last_date.month == 10)
      return new_transformation('No Data since no incomplete year', {})
    end
    start_date ||= Date.new(last_date.year)
    trim(start_date, nil)
  end
  
  def get_values_after(start_date, end_date = self.last_observation)
    data.reject {|date, value| date <= start_date or value.nil? or date > end_date}
  end
  
  def get_values_after_including(start_date, end_date = self.last_observation)
    data.reject {|date, value| date < start_date or value.nil? or date > end_date}
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def get_scaled_no_ph_after_inc_DELETEME(start_date, end_date = Time.now.to_date, round_to = 3)
    start_date = start_date.to_date
    end_date = end_date.to_date
    scaled_data_no_pseudo_history(round_to).reject do |date, value|
      date < start_date or value.nil? or date > end_date
    end
  end

  ## Obsolete? Track it down.
  def compressed_date_range_data(compressed_dates = Date.compressed_date_range)
    compressed_date_range_data = {}
    compressed_dates.each { |date| compressed_date_range_data[date] = data[date] }
    compressed_date_range_data
  end
  
  def get_data_for_month(month_num)
    return {} if month_num > 12 or month_num < 1
    data.reject {|date_string, _| date_string.month != month_num}
  end

  def shift_by_months(num_months)
    new_transformation("Shifted Series #{self.name} by #{num_months} months",
             self.data.map {|date,val| [date + num_months.months, val] }.to_h)
  end

  def shift_by_years(num_years)
    new_transformation("Shifted Series #{self.name} by #{num_years} months",
             self.data.map {|date,val| [date + num_years.years, val] }.to_h)
  end

  def shift_forward_months(num_months)
    new_series_data = Hash[data.map {|date, val| [date + num_months.months, val]}]
    new_transformation("Shifted Series #{name} forward by #{num_months} months ", new_series_data)
  end

  def shift_backward_months(num_months)
    new_series_data = Hash[data.map {|date, val| [date - num_months.months, val]}]
    new_transformation("Shifted Series #{name} backwards by #{num_months} months ", new_series_data)
  end

  
  def shift_forward_years(num_years)
    new_series_data = Hash[data.map {|date, val| [date + num_years.years, val]}]
    new_transformation("Shifted Series #{name}", new_series_data)
  end
end
