module SeriesInterpolation
  def fixed_week(length = 7)
    @fixed_week = length
    self
  end

  def extend_first_back_to(date)
    first_data_point_date = first_observation
    first_data_point_val = at(first_data_point_date)

    offset = freq_per_freq(:month, frequency) || raise("Cannot handle frequency #{frequency}")
    new_date = first_data_point_date - offset.months

    new_data = {}
    while new_date >= Date.parse(date)
      new_data[new_date] = first_data_point_val
      new_date -= offset.months
    end
    new_transformation("Replicated the first value back to #{date}", new_data)
  end

  def extend_last_fwd_to_match(series_name)
    last_data_point_date = series_name.ts.last_observation
    current_last_data_point = last_observation
    last_data_point_val = at(current_last_data_point)

    offset = freq_per_freq(:month, frequency) || raise("Cannot handle frequency #{frequency}")
    new_date = current_last_data_point + offset.months

    new_data = {}
    while new_date <= last_data_point_date
      new_data[new_date] = last_data_point_val
      new_date += offset.months
    end
    new_transformation("Replicated the last value out to the last date of #{series_name}", new_data)
  end

  ## Add a missing data point by calculating from adjacent observations
  ## Usage: "SERIES_NAME".ts.add_missing_dp("2023-07-01", :average)
  ## Added to address BLS datapoints lost during Fall 2025 shutdown
  def add_missing_dp(date_str, operation = :average)
    target_date = Date.parse(date_str)

    # Find the adjacent data points (before and after the target date)
    sorted_dates = data.keys.sort
    prev_date = sorted_dates.select { |d| d < target_date }.last
    next_date = sorted_dates.select { |d| d > target_date }.first

    raise "No data point found before #{target_date}" unless prev_date
    raise "No data point found after #{target_date}" unless next_date

    prev_val = data[prev_date]
    next_val = data[next_date]

    # Calculate the new value based on the operation
    new_value = case operation
                when :average
                  (prev_val + next_val) / 2.0
                else
                  raise "Operation #{operation} is not supported. Use :average"
                end

    new_dp = { target_date => new_value }
    new_transformation("Added missing data point at #{target_date} (#{operation}) from #{self}", new_dp)
  end

  ## when monthly data are only available for alternate ("every other") month, fill in the gaps
  ## with the mean of surrounding monthly values.
  def fill_alternate_missing_months(range_start_date = nil, range_end_date = nil, from: nil, to: nil)
    raise "Cannot fill_alternate_missing_months on a series of frequency #{frequency}" unless frequency == 'month'
    semi = find_sibling_for_freq('S')
    start_date = Date.parse(from || range_start_date) rescue first_observation
    end_date = Date.parse(to || range_end_date) rescue last_observation
    new_dp = {}
    date = start_date + 1.month
    while date < end_date do
      prevm = date - 1.month
      nextm = date + 1.month
      if data[prevm] && data[nextm]
        new_dp[date] = (data[prevm] + data[nextm]) / 2.0
        if semi && date.month % 6 == 0
          semi_date = date - 5.months
          semi_val = semi.at(semi_date)
          if semi_val
            redistribute_semi(semi_val, semi_date, new_dp)
          end
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

      data.each do |date, val|
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
    temp_series_data = {}
    last_date = nil
    divisor = case
              when frequency.to_sym == :quarter && self.frequency == 'year'  then 4
              when frequency.to_sym == :month && self.frequency == 'quarter' then 3
              when frequency.to_sym == :day && self.frequency == 'month'     then 30.4375
              else raise("pseudo_centered_spline_interpolation from #{self.frequency} to #{frequency} not supported")
              end

    data.sort.each do |date, val|
      #first period only
      if last_date.nil?
        last_date = date
        temp_series_data[date] = val
        next
      end

      temp_series_data[date] = val + (val - temp_series_data[last_date]) * ((divisor - 1) / (divisor + 1).to_f)

      last_date = date
    end

    temp_series = new_transformation("Temp series from #{self}", temp_series_data)
    temp_series.frequency = self.frequency

    series_data = temp_series.linear_interpolate(frequency).data
    new_transformation("Pseudo Centered Spline Interpolation of #{self}", series_data, frequency)
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
      new_series_data = last_date.linear_path_to_previous_period(last_val, 0, self.frequency.to_sym, frequency) if new_series_data.nil?
      new_series_data.merge! date.linear_path_to_previous_period(val, diff, self.frequency.to_sym, frequency)
      last_val = val
      last_date = date
    end
    new_transformation("Interpolated (linear match last) from #{self}", new_series_data, frequency)
  end

  ## not deployed yet
  def daves_linear_interpolate_refactor(new_freq)
    src_freq = frequency.to_sym
    raise "Cannot interpolate #{src_freq} to #{new_freq}" unless (src_freq == :year && new_freq == :quarter) ||
                                                                 (src_freq == :quarter && new_freq == :month) ||
                                                                 (src_freq == :month && new_freq == :day)
    last_val = nil
    first_obs = first_observation  ## keep this call out of the loop
    interpol_data = {}
    data.sort.each do |date, val|
      diff = date == first_obs ? 0 : val - last_val
      interpol_data.merge! linear_path_to_previous_period(date, val, diff, src_freq, new_freq)
      last_val = val
    end
    new_transformation("Interpolated (linear match last) from #{self}", interpol_data, new_freq)
  end

  def linear_path_to_previous_period(date, start_val, diff, source_frequency, target_frequency)
    dpoints = {}
    if source_frequency == :year && target_frequency == :quarter
      dpoints = {
        date             => start_val - (diff / 4 * 3),
        date + 3.months  => start_val - (diff / 4 * 2),
        date + 6.months  => start_val - (diff / 4),
        date + 9.months  => start_val
      }
    elsif source_frequency == :quarter && target_frequency == :month
      dpoints = {
        date             => start_val - (diff / 3 * 2),
        date + 1.month   => start_val - (diff / 3),
        date + 1.months  => start_val
      }
    elsif source_frequency == :month && target_frequency == :day
      num_days = date.days_in_month
      (1..num_days).each do |days_back|
        dpoints[date + (days_back - 1).days] =  start_val - (diff / num_days * (num_days - days_back))
      end
    end
    dpoints
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

  ## This method is only used for a very restricted set of series. Do they really need their own unique
  ## interpolation algorithm, or will a standard one (like interpolate(), in this file) do?
  def trms_interpolate_to_quarterly
    raise InterpolationException if frequency != 'year'
    new_series_data = {}
    previous_data_val = nil
    previous_year = nil
    last_diff = nil
    data.sort.each do |key, val|
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
    new_series_data.sort.each do |key,val|
      if prev_val.nil?
        prev_val = val
        next
      end
      blma_new_series_data[key] = (val + prev_val) / 2
      prev_val = val
    end
    new_transformation("TRMS style interpolation of #{self.name}", blma_new_series_data, 'quarter')
  end

  def fill_missing_months_linear
    raise "Must be a monthly series" unless (self.frequency == 'month')

    # this only includes the visible points
    data_copy = self.data.sort
    filled_data = {}
    raise "Must have at least two points" unless (data_copy.length >= 2)

    (0...(data_copy.length - 1)).each do |i|
      date1, val1 = data_copy[i]
      date2, val2 = data_copy[i + 1]

      filled_data[date1] = val1

      # for each month in between two points, make it first point + step * offset
      gap = (date2.year * 12 + date2.month) - (date1.year * 12 + date1.month) - 1
      step = (val2 - val1) / (gap + 1).to_f
      (1..gap).each do |m|
        filled_data[date1 >> m] = val1 + step * m
      end
    end

    last_date, last_val = data_copy.last
    filled_data[last_date] = last_val
    new_transformation("Linear month gap fill for #{self.name}", filled_data, 'month')
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
