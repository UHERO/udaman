module SeriesSeasonalAdjustment
  #may need to spec a test for this in terms of adding the correct source
  def apply_seasonal_adjustment(factor_application)
    ns_series = find_ns_series || raise(SeasonalAdjustmentException, "No NS series corresponds to #{self}")
    set_factors factor_application 
    new_ns_values = ns_series.get_values_after(Date.parse last_demetra_date.to_s)
    adjusted_data = {}
    new_ns_values.each do |date, value|
      factor_month = date.month
      adjusted_data[date] = value - factors[factor_month.to_s] if factor_application == :additive
      adjusted_data[date] = value / factors[factor_month.to_s] if factor_application == :multiplicative
    end
    #still valuable to run as the current series because it sets the seasonal factors
    new_transformation("Applied #{factor_application} Seasonal Adjustment against #{ns_series}", adjusted_data)
  end

  ### still need this?
  def apply_growth_rate_incompl_year
    apply_ns_growth_rate_sa.no_trim_future.get_last_incomplete_year
  end

  def apply_ns_growth_rate_sa
    ns_series = find_ns_series || raise(SeasonalAdjustmentException, "No NS series corresponds to #{self}")
    shifted_self = self.shift_forward_years(1)
    adjusted_series = {}

    ns_series.data.sort.each do |date, value|
      prev = ns_series.at(date - 1.year) || next
      sval = shifted_self.at(date) || next
      apc = compute_percentage_change(value, prev)
      if prev == 0 || apc > 100
        adjusted_series[date] = value - prev + sval
      else
        adjusted_series[date] = (1 + apc / 100) * sval
      end
    end
    new_transformation("Applied Growth Rate Based Seasonal Adjustment against #{ns_series}", adjusted_series)
  end

  def set_factors(factor_application)
    self.factor_application = factor_application
    ns_series = find_ns_series || raise(SeasonalAdjustmentException, "No NS series corresponds to #{self}")
    self.factors ||= {}

    last_demetra_date = (self.frequency == 'quarter' or self.frequency == 'Q') ? self.get_last_complete_4th_quarter : self.get_last_complete_december
    self.last_demetra_date = last_demetra_date
    last_year_of_sa_values = get_values_after(last_demetra_date - 1.year, last_demetra_date)
    last_year_of_sa_values.sort.each do |date,sa_value|
      ns_value = ns_series.at(date)
      #puts "#{datestring} - ns:#{ns_value} sa:#{sa_value}"
      #think can just use months for both months and quarters to keep things simple
      factor_month = date.month
      self.factors[factor_month.to_s] = ns_value - sa_value if factor_application == :additive
      self.factors[factor_month.to_s] = ns_value / sa_value if factor_application == :multiplicative
    end
    self.save
  end
end
