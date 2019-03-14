module SeriesSharing
  def ma_series(ma_type = 'ma', start_date = self.data.keys.sort[0], end_date = Time.now.to_date)
    new_transformation("Moving Average of #{name}", ma_series_data(ma_type, start_date, end_date))
  end

  def moving_average_for_sa(start_date = self.data.keys.sort[0])
    prev_year = (Time.now - 1.year).year
    self.moving_average(start_date, "#{prev_year}-12-01")
  end

  def moving_average(start_date = self.data.keys.sort[0], end_date = Time.now.to_date)
    new_transformation("Moving Average of #{name}", ma_series_data('ma', start_date, end_date))
  end
  
  def moving_average_offset_early(start_date = self.data.keys.sort[0], end_date = Time.now.to_date)
    new_transformation("Moving Average of #{name}", ma_series_data('offset_ma', start_date, end_date))
  end

  def moving_average_annavg_padded(start_date = self.data.keys.sort[0], end_date = Time.now.to_date)
    ann_avg_data = annual_average.trim(start_date, end_date).data
    cma_data = ma_series_data('strict_cma', start_date, end_date)
    new_transformation("Moving Average of #{name} edge-padded with Annual Average", ann_avg_data.series_merge(cma_data))
  end

  def backward_looking_moving_average(start_date = self.data.keys.sort[0], end_date = Time.now.to_date)
    new_transformation("Backward Looking Moving Average of #{name}", ma_series_data('backward_ma', start_date, end_date))
  end
  
  def forward_looking_moving_average(start_date = self.data.keys.sort[0], end_date = Time.now.to_date)
    new_transformation("Forward Looking Moving Average of #{name}", ma_series_data('forward_ma', start_date, end_date))
  end
  
  def offset_forward_looking_moving_average(start_date = self.data.keys.sort[0], end_date = Time.now.to_date)
    new_transformation("Offset Forward Looking Moving Average of #{name}", ma_series_data('offset_forward_ma', start_date, end_date))
  end
  
  def aa_county_share_for(county_abbrev, series_prefix = self.parse_name[:prefix])
    county_sum = "#{series_prefix}NS@HON.M".ts + "#{series_prefix}NS@HAW.M".ts + "#{series_prefix}NS@MAU.M".ts + "#{series_prefix}NS@KAU.M".ts
    historical = "#{series_prefix}NS@#{county_abbrev}.M".ts.annual_average / county_sum.annual_average * self
    current_year = "#{series_prefix}NS@#{county_abbrev}.M".ts.backward_looking_moving_average.get_last_incomplete_year / county_sum.backward_looking_moving_average.get_last_incomplete_year * self
    new_transformation("Share of #{name} using ratio of #{series_prefix}NS@#{county_abbrev}.M over sum of #{series_prefix}NS@HON.M , #{series_prefix}NS@HAW.M , #{series_prefix}NS@MAU.M , #{series_prefix}NS@KAU.M using annual averages where available and a backward looking moving average for the current year",
      historical.data.series_merge(current_year.data))
  end

  ###########################################################################################################################################################
  def aa_state_based_county_share_for(county_code, series_prefix = self.parse_name[:prefix])
    county_name = Series.build_name [series_prefix + 'NS', county_code, 'M']
    county = county_name.ts
    state_name = Series.build_name [series_prefix + 'NS', 'HI', 'M']
    state = state_name.ts
    historical = county.annual_average / state.annual_average * self
    current_incomplete_year = Series.new #county.backward_looking_moving_average.get_last_incomplete_year / state.backward_looking_moving_average.get_last_incomplete_year * self
    new_transformation("Share of #{name} using ratio of #{county_name} over #{state_name}, using annual averages where available and a backward looking moving average for the current year",
        historical.data.series_merge(current_incomplete_year.data))
  end

  def mc_ma_county_share_for(county_code, series_prefix = self.parse_name[:prefix])
    freq = self.parse_name[:freq]
    county_name = Series.build_name [series_prefix + 'NS', county_code, freq]
    county = county_name.ts
    state_name = Series.build_name [series_prefix + 'NS', 'HI', freq]
    state = state_name.ts
    start_date = county.first_value_date
    end_date =   county.get_last_complete_december
    historical = county.moving_average_annavg_padded(start_date,end_date) / state.moving_average_annavg_padded(start_date,end_date) * self
    mean_corrected_historical = historical / historical.annual_sum * county.annual_sum
    current_incomplete_year = Series.new #county.moving_average_annavg_padded.get_last_incomplete_year / state.moving_average_annavg_padded.get_last_incomplete_year * self
    new_transformation("Share of #{self.name} using ratio of #{county_name} over #{state_name} using a mean corrected moving average (offset early), and annual average for the current year",
        mean_corrected_historical.data.series_merge(current_incomplete_year.data))
  end

  def mc_price_share_for(county_abbrev)
    series_prefix = self.name.split('@')[0]
    self_region = self.name.split('@')[1].split('.')[0]
    start_date = "#{series_prefix}NS@#{county_abbrev}.Q".ts.first_value_date
    shared_series = "#{name}".ts.share_using("#{series_prefix}NS@#{county_abbrev}.Q".ts.trim(start_date, get_last_complete_4th_quarter).moving_average, "#{series_prefix}NS@#{self_region}.Q".ts.trim(start_date, get_last_complete_4th_quarter).moving_average)
    mean_corrected_series = shared_series.share_using("#{series_prefix}NS@#{county_abbrev}.Q".ts.annual_average, shared_series.annual_average)
    current_year = "#{series_prefix}NS@#{county_abbrev}.Q".ts.backward_looking_moving_average.get_last_incomplete_year / "#{series_prefix}NS@#{self_region}.Q".ts.backward_looking_moving_average.get_last_incomplete_year * self
    new_transformation("Share of #{name} using ratio of the moving average #{series_prefix}NS@#{county_abbrev}.Q over the moving average of #{series_prefix}NS@#{self_region}.Q , mean corrected for the year",
        mean_corrected_series.data.series_merge(current_year.data))
  end

  #### looks like vestigial code -- commenting out for now, delete later
  # def mc_offset_price_share_for(county_abbrev)
  #   series_prefix = self.name.split("@")[0]
  #   self_region = self.name.split("@")[1].split(".")[0]
  #   start_date = "#{series_prefix}NS@#{county_abbrev}.Q".ts.first_value_date
  #   shared_series = "#{name}".ts.share_using("#{series_prefix}NS@#{county_abbrev}.Q".ts.moving_average_offset_early, "#{series_prefix}NS@#{self_region}.Q".ts.trim(start_date).moving_average_offset_early)
  #   mean_corrected_series = shared_series.share_using("#{series_prefix}NS@#{county_abbrev}.Q".ts.annual_average, shared_series.annual_average)
  #   new_transformation("Share of #{name} using ratio of the moving average #{series_prefix}NS@#{county_abbrev}.Q over the moving average of #{series_prefix}NS@#{self_region}.Q , mean corrected for the year",
  #       mean_corrected_series.data)
  # end
  
  def share_using(ratio_top, ratio_bottom)
    new_series = ratio_top / ratio_bottom * self
    new_transformation("Share of #{name} using ratio of #{ratio_top.name} over #{ratio_bottom.name}", new_series.data)
  end
  
  def Series.add_demetra_series_and_mean_correct(add_series_1, add_series_2, mc_series, file)
    as1 = add_series_1.ts.load_sa_from(file)
    as2 = add_series_2.ts.load_sa_from(file)
    as_sum = as1 + as2
    new_series = as_sum / as_sum.annual_sum * mc_series.ts.annual_sum
    new_transformation("#{add_series_1} + #{add_series_2} from demetra output of #{file} mean corrected against #{mc_series}", new_series.data, new_series.frequency)
  end

private
  def ma_series_data(ma_type = 'ma', start_date = self.data.keys.sort[0], end_date = Time.now.to_date)
    return {} if start_date.nil?
    trimmed_data = get_values_after(start_date - 1.month, end_date).sort
    last = trimmed_data.length - 1
    new_data = {}
    position = 0
    periods = window_size
    trimmed_data.each do |date, _|
      #start_pos = window_start(position, last, periods, ma_type)
      #end_pos = window_end(position, last, periods, ma_type)
      (start_pos, end_pos) = window_range(position, last, periods, ma_type)
      if start_pos && end_pos
        new_data[date] = compute_window_average(trimmed_data, start_pos, end_pos, periods)
      end
      position += 1
    end
    new_data
  end

  def window_start(position, last, periods, ma_type_string)
    half_window = periods / 2
    return position                 if ma_type_string == 'ma' and position < half_window #forward looking moving average
    return position - half_window   if ma_type_string == 'ma' and position >= half_window and position <= last - half_window #centered moving average
    return position - periods + 1   if ma_type_string == 'ma' and position > last - half_window #backward looking moving average
    return position + 1             if ma_type_string == 'offset_ma' and position < half_window #offset forward looking moving average
    return position - half_window   if ma_type_string == 'offset_ma' and position >= half_window and position <= last - half_window #centered moving average
    return position - periods + 1   if ma_type_string == 'offset_ma' and position > last - half_window #backward looking moving average
    return position                 if ma_type_string == 'forward_ma' #forward looking moving average
    return position + 1             if ma_type_string == 'offset_forward_ma' #offset forward looking moving average
    return position - periods + 1   if ma_type_string == 'backward_ma' and position - periods + 1 >= 0 #backward looking moving average
    return nil                      if ma_type_string == 'backward_ma' ## window would extend into undefined territory
    return position - half_window   if ma_type_string == 'strict_cma' && position >= half_window && position <= (last - half_window)
    return nil                      if ma_type_string == 'strict_cma' ## window would extend into undefined territory
    raise "unexpected window_start conditions at pos #{position}, ma_type=#{ma_type_string}"
  end

  def window_end(position, last, periods, ma_type_string)
    half_window = periods / 2
    return position + periods - 1   if ma_type_string == 'ma' and position < half_window #forward looking moving average
    return position + half_window   if ma_type_string == 'ma' and position >= half_window and position <= last - half_window #centered moving average
    return position                 if ma_type_string == 'ma' and position > last-half_window #backward looking moving average
    return position + periods       if ma_type_string == 'offset_ma' and position < half_window and position + periods <= last #offset forward looking moving average
    return position + half_window   if ma_type_string == 'offset_ma' and position >= half_window and position <= last - half_window #centered moving average
    return position                 if ma_type_string == 'offset_ma' and position > last-half_window #backward looking moving average
    return position + periods - 1   if ma_type_string == 'forward_ma' and position + periods - 1 <= last #forward looking moving average
    return nil                      if ma_type_string == 'forward_ma' ## window would extend into undefined territory
    return position + periods       if ma_type_string == 'offset_forward_ma' and position + periods <= last #offset forward looking moving average
    return nil                      if ma_type_string == 'offset_forward_ma' ## window would extend into undefined territory
    return position                 if ma_type_string == 'backward_ma' #backward looking moving average
    return position + half_window   if ma_type_string == 'strict_cma' && position >= half_window && position <= (last - half_window)
    return nil                      if ma_type_string == 'strict_cma' ## window would extend into undefined territory
    raise "unexpected window_end conditions at pos #{position}, ma_type=#{ma_type_string}"
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
    win_start < 0 || win_end > last ? [] : [win_start, win_end]
  end

  def compute_window_average(trimmed_data, start_pos, end_pos, periods)
    halve_endpoints = (end_pos - start_pos) == periods  ## for centered ma only (where win width == periods+1), but not forward/backward
    sum = 0
    (start_pos..end_pos).each do |i|
      value = trimmed_data[i][1]   ## because data is a 2D array [[date1, value1], [date2, value2], ...]
      value *= 0.50 if halve_endpoints && (i == start_pos || i == end_pos)
      sum += value
    end
    sum / periods.to_f
  end

  def window_size
    return 12 if frequency == 'month'
    return 4 if frequency == 'quarter' || frequency == 'year'
    raise "no window size defined for frequency #{frequency}!"
  end

end
