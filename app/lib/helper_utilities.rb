module HelperUtilities
=begin
  def code_from_frequency(frequency)
    return 'A' if frequency == :year || frequency == 'year' || frequency == :annual || frequency == 'annual'
    return 'Q' if frequency == :quarter || frequency == 'quarter'
    return 'M' if frequency == :month || frequency == 'month'
    return 'S' if frequency == :semi || frequency == 'semi' || frequency == 'semi-annually'
    return 'W' if frequency == :week || frequency == 'week' || frequency == 'weekly'
    return 'D' if frequency == :day || frequency == 'day' || frequency == 'daily'
    ''
  end

  def frequency_from_code(code)
    return :year if code == 'A' || code =='a'
    return :quarter if code == 'Q' || code =='q'
    return :month if code == 'M' || code == 'm'
    return :semi if code == 'S' || code == 's'
    return :week if code == 'W' || code == 'w'
    return :day if code == 'D' || code == 'd'
    nil
  end
=end
  ## Return the month number corresponding to start of quarter number passed in
  ## e.g. first_month_of_quarter(3) => 7
  def first_month_of_quarter(q)
    qnum = q.to_s.gsub(/\D/,'').to_i  ## allow for caller to pass things like "Q2"
    (qnum - 1) * 3 + 1
  end

  def convert_qspec_to_date(str)
    ## Quarter spec like YYYYQ1, YYYY-Q1, YYYY/Q1, YYYY-Q01, "YYYY Q1", "YYYY Q01", etc
    return nil unless str =~ /([12]\d\d\d)[-.\/ ]*Q0?([1234])/i
    '%s-%02d-01' % [$1, first_month_of_quarter($2)]
  end
end
