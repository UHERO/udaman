class Date
  include HelperUtilities

  def linear_path_to_previous_period(start_val, diff, source_frequency, target_frequency)
    if source_frequency == :year && target_frequency == :quarter
      return {
        self             => start_val - (diff / 4 * 3),
        self + 3.months  => start_val - (diff / 4 * 2),
        self + 6.months  => start_val - (diff / 4),
        self + 9.months  => start_val
      }
    end
    if source_frequency == :quarter && target_frequency == :month
      return {
        self             => start_val - (diff / 3 * 2),
        self + 1.month   => start_val - (diff / 3),
        self + 1.months  => start_val
      }
    end
    if source_frequency == :month && target_frequency == :day
      num_days = self.days_in_month
      data = {}
      (1..num_days).each do |days_back|
        data[self + (days_back - 1).days] =  start_val - (diff / num_days * (num_days - days_back))
      end
      return data
    end

    {}
  end

  def quarter
    '%s-Q%d' % [self.year, quarter_by_month(self.mon)]
  end
  
  def quarter_i
    str = '%s0%d' % [self.year, quarter_by_month(self.mon)]
    str.to_i
  end
  
  def quarter_s
    quarter_d.to_s
  end

  def quarter_d
    Date.new(self.year, first_month_of_quarter(quarter_by_month(self.mon)))
  end
  
  def semi_i
    return "#{self.year}01" if [1,2,3,4,5,6].include?(self.mon)
    return "#{self.year}02" if [7,8,9,10,11,12].include?(self.mon)
    raise "semi_i: invalid month #{self.mon}"
  end

  def semi_s
    semi_d.to_s
  end

  def semi_d
    Date.new(self.year, self.mon > 6 ? 7 : 1)
  end

  def tsd_start(f)
    return "#{self.year}0100"                         if f == "year"
    return semi_i.to_s+"00"                           if f == "semi"
    return quarter_i.to_s+"00"                        if f == "quarter"
    return month_i.to_s+"00"                          if f == "month"
    return (self - self.wday).to_s.gsub("-","")       if f == "week"
    self.to_s.gsub("-","")                            if f == "day"
  end
  
  def tsd_end(f)
    return (self - self.wday + 6).to_s.gsub("-","")   if f == "week"
    tsd_start(f)
  end
  
  def year_s
    year_d.to_s
  end

  def year_d
    Date.new(self.year)
  end
  
  def month_i
    strftime('%Y%m').to_i
  end

  def month_s
    month_d.to_s
  end

  def month_d
    Date.new(self.year, self.mon)
  end

  def week_d   ## weeks (Sun-Sat) are aggregated to the concluding Saturday
    saturday? ? self : next_occurring(:saturday)
  end

  def days_in_period(period)
    case period.to_s
      when 'year'
        self.leap? ? 366 : 365
      when 'semi'
        self.semi_d.days_in_period('quarter') + (self.semi_d >> 3).days_in_period('quarter')
      when 'quarter'
        self.quarter_d.days_in_month + (self.quarter_d >> 1).days_in_month + (self.quarter_d >> 2).days_in_month
      when 'month'
        self.days_in_month
      when 'week'
        7
      else
        raise "days_in_period: unknown period #{period}"
    end
  end
  
  def days_in_month
    Time.days_in_month(self.month, self.year)
  end

  def delta_days(other_endpt)
    raise 'delta_days: other endpoint is not a Date' unless other_endpt.class == Date
    (self - other_endpt).to_i.abs
  end

  ################### THIS NEEDS TO BE TOTALLY REWRITTEN TO BE A DATE INSTANCE METHOD
  def delta_months(start_date, end_date)
    unless start_date.class == Date
      start_date = Date.parse(start_date) rescue raise("delta_months: parameter #{start_date} not a proper date string")
    end
    unless end_date.class == Date
      end_date = Date.parse(end_date) rescue raise("delta_months: parameter #{end_date} not a proper date string")
    end
    if end_date < start_date
      Rails.logger.warn { 'delta_months: dates are in reverse of expected order, giving negative result' }
    end
    (end_date.year - start_date.year) * 12 + end_date.month - start_date.month
  end

end
