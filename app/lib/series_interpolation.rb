module SeriesInterpolation
  def fixed_week(length = 7)
    @fixed_week = length
    self
  end

  def interpolate_to (frequency, operation, series_to_store_name)
    series_to_store_name.ts = interpolate(frequency, operation)
  end
  
  def extend_first_data_point_back_to(date)
    new_data = {}
    first_data_point_date = self.first_value_date
    first_data_point_val = data[first_data_point_date]

    offset = 0
    offset = 1 if self.frequency == 'month'
    offset = 3 if self.frequency == 'quarter'
    offset = 6 if self.frequency == 'semi'
    offset = 12 if self.frequency == 'year'
    new_date = first_data_point_date - offset.months

    while new_date >= Date.parse(date)
      new_data[new_date] = first_data_point_val
      new_date = new_date - offset.months
    end
    new_transformation("Extended the first value back to #{date}", new_data)
  end
  
  def extend_last_date_to_match(series_name)
    new_data = {}
    last_data_point_date = series_name.ts.last_value_date rescue raise("Series #{series_name} does not exist")
    current_last_data_point = self.last_value_date
    
    last_data_point_val = data[current_last_data_point]
    
    offset = 0
    offset = 1 if self.frequency == 'month'
    offset = 3 if self.frequency == 'quarter'
    offset = 6 if self.frequency == 'semi'
    offset = 12 if self.frequency == 'year'
    new_date = current_last_data_point + offset.months

    while new_date <= last_data_point_date
      new_data[new_date] = last_data_point_val
      new_date = new_date + offset.months
    end
    new_transformation("Extended the value value out to the last date of #{series_name}", new_data)
  end

  ## when monthly data are only available for alternate ("every other") month, fill in the gaps
  ## with the mean of surrounding monthly values.
  def fill_alternate_missing_months(range_start_date = nil, range_end_date = nil)
    raise InterpolationException unless frequency == 'month'
    semi = find_sibling_for_freq('S')
    start_date = range_start_date ? Date.strptime(range_start_date) : data.sort[0][0]
    end_date = range_end_date ? Date.strptime(range_end_date) : data.sort[-1][0]
    new_dp = {}
    date = start_date + 1.month
    while date < end_date do
      prevm = date - 1.month
      nextm = date + 1.month
      unless data[prevm] && data[nextm]
        raise InterpolationException, 'data not strictly alternating months'
      end
      new_dp[date] = (data[prevm] + data[nextm]) / 2.0
      if semi && date.month % 6 == 0
        semi_date = date - 5.months
        semi_val = semi.at(semi_date)
        if semi_val
          redistribute_semi(semi_val, semi_date, new_dp)
        end
      end
      date += 2.months ## track only the missing data points
    end
    new_transformation("Interpolation of alternate missing months from #{self}", new_dp)
  end

  def fill_interpolate_to(target_frequency)
    freq = self.frequency.to_s
    new_series_data = {}
    if  freq == 'year'
      if target_frequency == :quarter
        month_vals = (1..12).to_a.select {|m| m % 3 == 1}
      elsif target_frequency == :month
        month_vals = (1..12).to_a
      else
        raise InterpolationException
      end

      self.data.each do |date, val|
        month_vals.each {|month| new_series_data[Date.new(date.year, month)] = val }
      end
    else
      raise InterpolationException
    end
    new_transformation("Interpolated by filling #{self} to #{target_frequency}", new_series_data, target_frequency.to_s)
  end
  
  def fill_days_interpolation
    interpolate_week_to_day :fill
  end

  def distribute_days_interpolation
    interpolate_week_to_day :distribute
  end

  ### Assumes that weekly observations fall at the END of the week they represent, whatever weekday that might be.
  ### It's almost always Saturday, and we should try to keep it that way.
  def interpolate_week_to_day(method)
    raise "unknown method #{method}" unless method == :fill || method == :distribute
    raise(InterpolationException, 'original series not weekly') if frequency != 'week'
    dailyseries = {}
    weekly_keys = data.keys.sort
    loop do
      date = weekly_keys.pop || break
      fill_length = @fixed_week || (date - weekly_keys[-1]).to_i rescue 7  ## rescue should only happen when keys array is empty
      if (fill_length < 5 || fill_length > 9) && !@fixed_week
        raise InterpolationException, "observation gap of #{fill_length} days too long or short near #{date}"
      end
      value = method == :fill ? data[date] : (data[date] / fill_length.to_f)
      (0...fill_length).each {|offset| dailyseries[date - offset.days] = value }  ## note the three dots
    end
    new_transformation("Interpolated days (#{method}) from #{self}", dailyseries.sort, :day)
  end

  def pseudo_centered_spline_interpolation(frequency)
    raise AggregationException unless (frequency == :quarter and self.frequency == 'year') or
                                  (frequency == :month and self.frequency == 'quarter') or 
                                  (frequency == :day and self.frequency == 'month')

    divisor = 4 if frequency == :quarter and self.frequency == 'year'
    divisor = 3 if frequency == :month and self.frequency == 'quarter'
    divisor = 30.4375 if frequency == :day and self.frequency == 'month'
    
    temp_series_data = {}
    #last_temp_val = nil
    last_date = nil
    first_val = nil

    self.data.sort.each do |date, val|
      #first period only
      if last_date.nil?
        last_date = date
        temp_series_data[date] = val
        first_val = val
        next
      end
      
      temp_series_data[date] = val + (val - temp_series_data[last_date]) * ((divisor - 1) / (divisor + 1).to_f)
      
      last_date = date
    end
    
    temp_series = new_transformation("Temp series from #{self.name}", temp_series_data)
    temp_series.frequency = self.frequency
    
    series_data = temp_series.linear_interpolate(frequency).data
    new_transformation("Pseudo Centered Spline Interpolation of #{self.name}", series_data, frequency)
  end

  #first period is just first value
  def linear_interpolate(frequency)
    raise AggregationException unless (frequency == :quarter and self.frequency == 'year') or
                                  (frequency == :month and self.frequency == 'quarter') or 
                                  (frequency == :day and self.frequency == 'month')
    data_copy = self.data.sort
    last_val = data_copy[0][1]
    last_date = data_copy[0][0]
    first = data_copy.shift
    
    new_series_data = nil
    data_copy.each do |date, val|
      diff = val - last_val
      new_series_data = last_date.linear_path_to_previous_period(last_val, 0, self.frequency, frequency) if new_series_data.nil?
      new_series_data.merge! date.linear_path_to_previous_period(val, diff, self.frequency, frequency)
      last_val = val
      last_date = date
    end
    new_transformation("Interpolated (linear match last) from #{self.name}", new_series_data, frequency)
  end
  
  
  def census_interpolate(frequency)
    raise AggregationException if frequency != :quarter and self.frequency != 'year'
    quarterly_data = {}
    last = nil
    started_interpolation = false
    data.sort.each do |key, value|
      unless last.nil?
        year = key.year
        step = (value - last) / 4
        quarterly_data[Date.new(year - 1, 10)] = value - 3 * step
        quarterly_data[Date.new(year)]   = value - 2 * step
        quarterly_data[Date.new(year, 4)]   = value - 1 * step
        quarterly_data[Date.new(year, 7)]   = value
        unless started_interpolation
          quarterly_data[Date.new(year - 2, 10)] = last - 3 * step
          quarterly_data[Date.new(year - 1)]   = last - 2 * step
          quarterly_data[Date.new(year - 1, 4)]   = last - 1 * step
          quarterly_data[Date.new(year - 1, 7)]   = last
          started_interpolation = true
        end
      end
      last = value
    end
    new_transformation("Interpolated with Census method from #{self.name}", quarterly_data, frequency)
  end

  ## Generalized interpolation of a series to a higher frequency. Implemented following the algorithm for linear
  ## interpolation found in AREMOS command reference, with help from PF.
  def interpolate(target_freq, method = :average)
    raise(InterpolationException, "Interpolation method #{method} not supported") unless method == :average || method == :sum
    raise(InterpolationException, 'Can only interpolate to a higher frequency') unless target_freq.freqn > frequency.freqn
    raise(InterpolationException, 'Insufficent data') if data.count < 2
    interpol_data = {}
    last_date = last_val = increment = nil
    how_many = freq_per_freq(target_freq, frequency)
    target_months = freq_per_freq(:month, target_freq)
    all_factors = {
      year: { quarter: [-1.5, -0.5, 0.5, 1.5] },
      semi: { quarter: [-0.5, 0.5], month: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] },
      quarter: { month: [-1, 0, 1] }
    }
    factors = all_factors[frequency.to_sym][target_freq] ||
              raise(InterpolationException, "Interpolation from #{frequency} to #{target_freq} not yet supported")

    data.sort.each do |this_date, this_val|
      next if this_val.nil?
      if last_val
        increment = (this_val - last_val) / how_many.to_f   ## to_f ensures float division not truncated
        values = factors.map {|f| last_val + f * increment }
        values = values.map {|val| val / how_many.to_f } if method == :sum
        (0...how_many).each do |t|   ## note the three dots
          date = last_date + (t * target_months).months
          interpol_data[date] = values[t]
        end
      end
      last_date = this_date
      last_val = this_val
    end
    ### Repeat logic from inside above loop for final observation of original series
    values = factors.map {|f| last_val + f * increment }
    values = values.map {|val| val / how_many.to_f } if method == :sum
    (0...how_many).each do |t|
      date = last_date + (t * target_months).months
      interpol_data[date] = values[t]
    end
    new_transformation("Interpolated by #{method} method from #{self}", interpol_data, target_freq)
  end

  # this method looks obsolete/vestigial - rename now, remove later
  def interpolate_missing_months_and_aggregate_DELETEME(frequency, operation)
    last_val = nil
    last_date = nil
    monthly_series_data = {}
    data.sort.each do |key, val|
      next if val.nil?
      monthly_series_data[key] = val
      unless last_val.nil?
        val_diff = val - last_val
        d1 = key
        d2 = last_date
        month_diff = (d1.year - d2.year) * 12 + (d1.month - d2.month)
        #puts "#{key}: #{month_diff}"
        (1..month_diff-1).each { |offset| monthly_series_data[d2 + offset.months] = last_val + (val_diff / month_diff) * offset }
      end
      last_val = val
      last_date = key
    end
    monthly_series = new_transformation("Interpolated Monthly Series from #{self.name}", monthly_series_data, 'month')
    monthly_series.aggregate(frequency, operation)

  end
  
  def trms_interpolate_to_quarterly
    raise InterpolationException if frequency != 'year'
    new_series_data = {}
    previous_data_val = nil
    previous_year = nil
    last_diff = nil
    self.data.sort.each do |key,val|
      if previous_data_val.nil?
        previous_data_val = val
        previous_year = key
        next
      end
      year = previous_year.year
      new_series_data[Date.new(year)] = previous_data_val - (val - previous_data_val) / 4 * 1.5
      new_series_data[Date.new(year, 4)] = previous_data_val - (val - previous_data_val) / 4 * 0.5
      new_series_data[Date.new(year, 7)] = previous_data_val + (val - previous_data_val) / 4 * 0.5
      new_series_data[Date.new(year, 10)] = previous_data_val + (val - previous_data_val) / 4 * 1.5
      last_diff = val - previous_data_val
      previous_data_val = val
      previous_year = key  
    end
    
    year = previous_year.year
    new_series_data[Date.new(year)] = previous_data_val - last_diff / 4 * 1.5
    new_series_data[Date.new(year, 4)] = previous_data_val - last_diff / 4 * 0.5
    new_series_data[Date.new(year, 7)] = previous_data_val + last_diff / 4 * 0.5
    new_series_data[Date.new(year, 10)] = previous_data_val + last_diff / 4 * 1.5
    
    blma_new_series_data = {}
    prev_val = nil
    prev_date = nil
    new_series_data.sort.each do |key,val|
      if prev_val.nil?
        prev_val = val
        prev_date = key
        next
      end
      blma_new_series_data[key] = (val + prev_val) / 2
      prev_val = val
      prev_date = key
    end
    new_transformation("TRMS style interpolation of #{self.name}", blma_new_series_data, 'quarter')
  end

private

  ## Find interpolated values in the 6-month range starting at start_month, and redistribute the difference between
  ## the semiannual value and the average of all the monthlies in that range across (only) the interpolated months.
  ## Note! This code assumes that the even (calendar) numbered months are interpolated and odd numbered ones have real data.
  def redistribute_semi(semi_annual_val, start_month, new_data)
    six_month = []
    (0..5).each do |offset|
      date = start_month + offset.months
      value = new_data[date] || data[date]
      return if value.nil?  ## bail if even a single monthly value is missing
      six_month.push(value)
    end
    diff = (semi_annual_val - six_month.average) * 2.0  ## must be float multiplication
    begin
      (new_data[start_month + 1.months] += diff) rescue raise('1')
      (new_data[start_month + 3.months] += diff) rescue raise('3')
      (new_data[start_month + 5.months] += diff) rescue raise('5')
    rescue => e
      bad_date = start_month + e.message.to_i.months
      raise "redistribute_semi: cannot redistribute because data missing at #{bad_date}"
    end
  end
end
