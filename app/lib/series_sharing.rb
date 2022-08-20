module SeriesSharing
  def ma_series(ma_type = 'ma', start_date = first_observation, end_date = Time.now.to_date)
    new_transformation("Moving Average of #{self}", ma_series_data(ma_type, start_date, end_date))
  end

  def moving_average_for_sa(start_date = first_observation)
    prev_year = (Time.now - 1.year).year
    self.moving_average(start_date, "#{prev_year}-12-01")
  end

  def moving_average(start_date = first_observation, end_date = Time.now.to_date)
    new_transformation("Moving Average of #{self}", ma_series_data('ma', start_date, end_date))
  end
  
  def moving_average_offset_early(start_date = first_observation, end_date = Time.now.to_date)
    new_transformation("Moving Average of #{self}", ma_series_data('offset_ma', start_date, end_date))
  end

  def moving_average_annavg_padded(start_date = first_observation, end_date = Time.now.to_date)
    ann_avg_data = annual_average.trim(start_date, end_date).data
    cma_data = ma_series_data('strict_cma', start_date, end_date)
    new_transformation("Moving Average of #{self} edge-padded with Annual Average", ann_avg_data.series_merge(cma_data))
  end

  def backward_looking_moving_average(start_date = first_observation, end_date = Time.now.to_date, window: standard_window_size)
    new_transformation("Backward-looking moving average of #{self} using window size #{window}",
                       ma_series_data('backward_ma', start_date, end_date, window: window))
  end
  
  def forward_looking_moving_average(start_date = first_observation, end_date = Time.now.to_date, window: standard_window_size)
    new_transformation("Forward-looking moving average of #{self} using window size #{window}",
                       ma_series_data('forward_ma', start_date, end_date, window: window))
  end
  
  def offset_forward_looking_moving_average(start_date = first_observation, end_date = Time.now.to_date)
    new_transformation("Offset Forward Looking Moving Average of #{self}", ma_series_data('offset_forward_ma', start_date, end_date))
  end

  ## Seems this function is not actually used anymore, but refactoring anyway, in case it is revived
  def aa_county_share_for(county_code, prefix = self.parse_name[:prefix])
    county_names = %w{HON HAW MAU KAU}.map{|cty| Series.build_name(prefix + 'NS', cty, 'M') } ## list of names like FOONS@HAW.M
    county_sum = 0
    county_names.each do |name|
      county_sum = name.ts + county_sum rescue raise("series #{name} does not exist")
      ## after first iteration, county_sum becomes a Series
    end
    c_name = Series.build_name(prefix + 'NS', county_code, 'M')
    county = c_name.ts || raise("series #{c_name} does not exist")

    historical = county.annual_average / county_sum.annual_average * self
    incomplete_year = county.backward_looking_moving_average.get_last_incomplete_year / county_sum.backward_looking_moving_average.get_last_incomplete_year * self
    new_transformation("Share of #{self} using ratio of #{county} over #{county_names.join('+')} using annual averages where available and a backward looking moving average for the current year",
      historical.data.series_merge(incomplete_year.data))
  end

  def aa_state_based_county_share_for(county_code, prefix = self.parse_name[:prefix])
    state = Series.build_name(prefix + 'NS', 'HI', 'M').ts || raise("no HI.M series found for #{prefix + 'NS'}")
    county = state.find_sibling_for_geo(county_code) || raise("no #{county_code} sibling found for #{state}")

    historical = county.annual_average / state.annual_average * self
    incomplete_year = Series.new #county.backward_looking_moving_average.get_last_incomplete_year / state.backward_looking_moving_average.get_last_incomplete_year * self
    new_transformation("Share of #{self} using ratio of #{county} over #{state} using annual averages, only for full years",
        historical.data.series_merge(incomplete_year.data))
  end

  def mc_ma_county_share_for(county_code, prefix = self.parse_name[:prefix])
    freq = self.parse_name[:freq]
    state = Series.build_name(prefix + 'NS', 'HI', freq).ts || raise("no HI.#{freq} series found for #{prefix + 'NS'}")
    county = state.find_sibling_for_geo(county_code) || raise("no #{county_code} sibling found for #{state}")
    start_date = county.first_value_date
    end_date =   county.get_last_complete_december

    historical = county.moving_average_annavg_padded(start_date,end_date) / state.moving_average_annavg_padded(start_date,end_date) * self
    mean_corrected_historical = historical / historical.annual_sum * county.annual_sum
    incomplete_year = Series.new #county.moving_average_annavg_padded.get_last_incomplete_year / state.moving_average_annavg_padded.get_last_incomplete_year * self
    new_transformation("Share of #{self} using ratio of #{county} over #{state} using a mean corrected moving average, only for full years",
        mean_corrected_historical.data.series_merge(incomplete_year.data))
  end

  def mc_price_share_for(county_code)
    c_name = build_name(prefix: self.parse_name[:prefix] + 'NS', geo: county_code)
    county = c_name.ts || raise("series #{c_name} does not exist")
    my_ns_series = self.find_ns_series || raise("No NS series corresponds to #{self}")
    start_date = county.first_value_date
    end_date = get_last_complete_4th_quarter

    shared_series = share_using(county.trim(start_date, end_date).moving_average, my_ns_series.trim(start_date, end_date).moving_average)
    mean_corrected_series = shared_series.share_using(county.annual_average, shared_series.annual_average)
    incomplete_year = county.backward_looking_moving_average.get_last_incomplete_year / my_ns_series.backward_looking_moving_average.get_last_incomplete_year * self
    new_transformation("Share of #{self} using ratio of the moving average #{county.name} over the moving average of #{my_ns_series.name}, mean corrected for the year",
        mean_corrected_series.data.series_merge(incomplete_year.data))
  end

  def share_using(ratio_top, ratio_bottom)
    new_series = ratio_top / ratio_bottom * self
    new_transformation("Share of #{self} using ratio of #{ratio_top} over #{ratio_bottom}", new_series.data)
  end
  
  def Series.add_demetra_series_and_mean_correct(add_series_1, add_series_2, mc_series, file)
    as1 = add_series_1.ts.load_sa_from(file)
    as2 = add_series_2.ts.load_sa_from(file)
    as_sum = as1 + as2
    new_series = as_sum / as_sum.annual_sum * mc_series.ts.annual_sum
    new_transformation("#{add_series_1} + #{add_series_2} from demetra output of <#{file}> mean corrected against #{mc_series}", new_series.data, new_series.frequency)
  end

private

  def ma_series_data(ma_type = 'ma', start_date = first_observation, end_date = Time.now.to_date, window: nil)
    return {} if start_date.nil?
    trimmed_data = get_values_after(start_date - 1.month, end_date).sort
    last = trimmed_data.length - 1
    new_data = {}
    position = 0
    periods = window || standard_window_size
    trimmed_data.each do |date, _|
      (start_pos, end_pos) = window_range(position, last, periods, ma_type)
      if start_pos && end_pos
        new_data[date] = compute_window_average(trimmed_data, start_pos, end_pos, periods)
      end
      position += 1
    end
    new_data
  end

  def window_range(position, last, periods, ma_type)
    half_window = periods / 2
    at_left_edge = position < half_window
    at_right_edge = position > last - half_window
    forward_looking =  [position, position + periods - 1]
    backward_looking = [position - periods + 1, position]
    centered = [position - half_window, position + half_window]
    (win_start, win_end) =
        case ma_type
          when 'ma', 'offset_ma'
            case
              when at_left_edge  then forward_looking
              when at_right_edge then backward_looking
              else centered
            end
          when /forward_ma/  then forward_looking
          when /backward_ma/ then backward_looking
          when 'strict_cma'  then centered
          else raise "unexpected window conditions at pos #{position}, ma_type=#{ma_type}"
        end
    if ma_type == 'offset_forward_ma' || (ma_type == 'offset_ma' && at_left_edge)
      win_start += 1
      win_end += 1
    end
    win_start < 0 || win_end > last ? [] : [win_start, win_end]   ## return empty [] if window overlaps undefined territory
  end

  def compute_window_average(trimmed_data, start_pos, end_pos, periods)
    halve_endpoints = (end_pos - start_pos) == periods  ## for centered ma only (where win width == periods+1), but not forward/backward
    sum = 0
    (start_pos..end_pos).each do |i|
      begin
        value = trimmed_data[i][1]   ## because data is a 2D array [[date1, value1], [date2, value2], ...]
      rescue
        return 0.0
      end
      value *= 0.50 if halve_endpoints && (i == start_pos || i == end_pos)
      sum += value
    end
    sum / periods.to_f
  end

  def standard_window_size
    case frequency.to_sym
      when :day   then 7
      when :month then 12
      when :week, :quarter, :year then 4
      else raise "no window size defined for frequency #{frequency}"
    end
  end

end
