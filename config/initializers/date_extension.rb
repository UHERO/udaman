class Date
  def linear_path_to_previous_period(start_val, diff, source_frequency, target_frequency)
    if (source_frequency == 'year' or source_frequency == :year) and target_frequency == :quarter
      return {
        self             => start_val - (diff / 4 * 3),
        self + 3.months  => start_val - (diff / 4 * 2),
        self + 6.months  => start_val - (diff / 4),
        self + 9.months  => start_val
      }
    end

    if (source_frequency == 'quarter' or source_frequency == :quarter) and target_frequency == :month
      return {
        self             => start_val - (diff / 3 * 2),
        self + 1.month   => start_val - (diff / 3),
        self + 1.months  => start_val
      }
    end
    if (source_frequency == 'month' or source_frequency == :month) and target_frequency == :day
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
    return "#{self.year}-Q1" if [1,2,3].include?(self.mon)
    return "#{self.year}-Q2" if [4,5,6].include?(self.mon)
    return "#{self.year}-Q3" if [7,8,9].include?(self.mon)
    return "#{self.year}-Q4" if [10,11,12].include?(self.mon)
  end
  
  def quarter_i
    return "#{self.year}01".to_i if [1,2,3].include?(self.mon)
    return "#{self.year}02".to_i if [4,5,6].include?(self.mon)
    return "#{self.year}03".to_i if [7,8,9].include?(self.mon)
    return "#{self.year}04".to_i if [10,11,12].include?(self.mon)
  end
  
  def quarter_s
    return "#{self.year}-01-01" if [1,2,3].include?(self.mon)
    return "#{self.year}-04-01" if [4,5,6].include?(self.mon)
    return "#{self.year}-07-01" if [7,8,9].include?(self.mon)
    return "#{self.year}-10-01" if [10,11,12].include?(self.mon)
  end
  
  def semi_i
    return "#{self.year}01" if [1,2,3,4,5,6].include?(self.mon)
    return "#{self.year}02" if [7,8,9,10,11,12].include?(self.mon)
  end
  
  def tsd_start(f)
    return "#{self.year}0100"                         if f == "year"
    return semi_i.to_s+"00"                           if f == "semi"
    return quarter_i.to_s+"00"                        if f == "quarter"
    return month_i.to_s+"00"                          if f == "month"
    return (self - self.wday).to_s.gsub("-","")       if f == "week"
    return self.to_s.gsub("-","")                     if f == "day"
  end
  
  def tsd_end(f)
    return (self - self.wday + 6).to_s.gsub("-","")   if f == "week"
    tsd_start(f)
  end
  
  def year_s
    return year.to_s+"-01-01"
  end
  
  def month_i
    return strftime('%Y%m').to_i
  end

  def month_s
    return strftime('%Y-%m-01')
  end
  
  def semi_s
    return "#{self.year}-01-01" if [1,2,3,4,5,6].include?(self.mon)
    return "#{self.year}-07-01" if [7,8,9,10,11,12].include?(self.mon)
  end
  
  def days_in_period(frequency)
    return (self.leap? ? 366 : 365) if frequency == "year"
    return self.days_in_month + (self >> 1).days_in_month + (self >> 2).days_in_month if frequency == "quarter"
    return self.days_in_month if frequency == "month"
  end
  
  def days_in_month
    Time.days_in_month(self.month, self.year)
  end
  
  def Date.last_7_days
    last_7 = []
    (0..6).each { |index| last_7[index] = (today - index).to_s }
    last_7.reverse
  end
  
  def Date.last_4_weeks
    last_sunday = today - today.cwday
    last_4 = []
    (0..3).each { |index| last_4[index] = (last_sunday - 7 * index).to_s }
    last_4.reverse
  end
  
  def Date.last_12_months
    last_12 = []
    (0..11).each { |index| last_12[index] = (today << index).month_s }
    last_12.reverse
  end
  
  def Date.last_10_years
    this_year = today.year
    last_10 = []
    (0..9).each { |index| last_10[index] = "#{this_year - index}-01-01" }
    last_10.reverse
  end
  
  def Date.last_10_decades
    this_decade = today.year / 10 * 10
    last_10 = []
    (0..9).each { |index| last_10[index] = "#{this_decade - index*10}-01-01" }
    last_10.reverse
  end
  
  def Date.compressed_date_range
    (last_7_days + last_4_weeks + last_12_months + last_10_years + last_10_decades).uniq.sort
  end
  
end

