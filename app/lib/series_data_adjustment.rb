module SeriesDataAdjustment
  include ActionView::Helpers::DateHelper

  def first_value_date   ## this is an alias. Calls to this method could be replaced and the alias eliminated.
    first_observation
  end
     
  def last_value_date   ## this is an alias. Calls to this method could be replaced and the alias eliminated.
    last_observation
  end

  def trim(start_date = nil, end_date = nil, before: nil, after: nil)
    ## more flexibility to allow either or both parameters to be passed as nil and assign defaults within
    start_date ||= (before || self.trim_period_start || get_last_incomplete_january)
      end_date ||= (after  || self.trim_period_end || Time.now)
    if start_date.nil?
      return new_transformation("Trimmed #{name}", data)
    end
    new_series_data = get_values_after_including(start_date.to_date, end_date.to_date)
    new_name = start_date.to_s == '1000-01-01' ? name : "Trimmed #{name} starting #{start_date}"
    new_transformation(new_name, new_series_data)
  end

  def no_trim_past
    self.tap {|o| o.trim_period_start = '1000-01-01' }  ## Beginning of Time
  end

  def no_trim_future
    self.tap {|o| o.trim_period_end = '2999-12-31' }  ## End of Time
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
    return trim(start_date, nil) if start_date  ## special handling for unusual cases where we want to force a specific cutoff
    last_date = self.last_observation
    return nil if last_date.nil?
    if (frequency == 'month' && last_date.month == 12) || (frequency == 'quarter' && last_date.month == 10)
      return new_transformation('No data because no incomplete year', {})
    end
    trim(Date.new(last_date.year), nil)
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

  def shift_by(laglead)  ## laglead is expected to be a time duration, like 7.days, -1.month, 4.years, etc.
    dir = laglead < 0 ? 'backward' : 'forward'
    laglead_s = distance_of_time_in_words(laglead).sub(/(about|almost) /,'')
    new_transformation("#{self} shifted #{dir} by #{laglead_s}", data.map {|date, value| [date + laglead, value] })
  end

end
