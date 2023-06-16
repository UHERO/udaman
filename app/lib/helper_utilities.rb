module HelperUtilities
  ## Return the month number corresponding to start of quarter number passed in
  ## e.g. first_month_of_quarter(3) => 7; first_month_of_quarter("Q1") => 1
  def first_month_of_quarter(q)
    qnum = q.to_s.gsub(/\D/,'').to_i  ## allow for caller to pass things like "Q2"
    raise 'first_month_of_quarter: Invalid quarter number in %s' % q unless [1,2,3,4].include?(qnum)
    qnum * 3 - 2
  end

  ## Put in any month number, get out quarter number
  ## e.g. quarter_by_month(11) => 4
  def quarter_by_month(mon)
    raise 'quarter_by_month: Invalid month number %s' % mon unless 0 < mon.to_i && mon.to_i < 13
    (mon.to_i - 1) / 3 + 1
  end

  ## Put in quarter spec like YYYYQ1, YYYY-Q1, YYYY/Q1, YYYY-Q01, "YYYY Q1", "YYYY Q01", etc
  ## get out date form, e.g. qspec_to_date("2012Q2") => "2012-04-01"
  def qspec_to_date(qstr)
    return nil unless qstr =~ /([12]\d\d\d)[-.\/ ]?Q0?([1234])/i
    '%s-%02d-01' % [$1, first_month_of_quarter($2)]
  end

  ## Put in date (either string or Date object), get out quarter spec; opt. second param is delimiter string
  ## e.g. date_to_qspec("2018-03-01") => "2018Q1"; date_to_qspec("2018-10-01", "-") => "2018-Q4"
  def date_to_qspec(date, delim = nil)
    unless date.class == Date
      date = grok_date(date)
    end
    '%s%sQ%d' % [date.year, delim, quarter_by_month(date.mon)]
  end

  ## Parse a wide variety of date string formats and produce a Date object
  def grok_date(parm, other_str = nil)
    return parm if parm.class == Date
    str = parm.to_s rescue raise('grok_date expects a parameter that can be converted to String, got %s' % parm.class)
    if other_str
      year = Integer(str) rescue raise('grok_date: expected 4-digit year as first parameter, got %s' % str)
      month = case other_str
              when /^M?(0[1-9]|1[0-2])\b/ then $1.to_i
              when /^(M13|S0?1)\b/        then 1
              when /^S0?2\b/              then 7
              when /^Q0?([1-4])\b/        then first_month_of_quarter($1)
              when ''                     then 1
              else raise('grok_date: ungrokkable second parameter: %s' % other_str)
              end
      return Date.new(year, month)
    end
    ## Somewhat readable? way of doing cascading rescue
    Date.strptime(str, '%Y-%m-%d') rescue \
      Date.strptime(str, '%Y-%m')  rescue \
        Date.strptime(str, '%Y%m') rescue \
          Date.new(Integer str)    rescue \
            qspec_to_date(str).to_date rescue raise('grok_date: ungrokkable date format: %s' % str)
  end

  ## Return how many higher frequency units there are in a lower (or =) frequency unit. Nil if not defined.
  def freq_per_freq(higher, lower)
    higher = higher.to_sym
    lower = lower.to_sym
    return 1 if lower == higher
    per = { year: { semi: 2, quarter: 4, month: 12 },
            semi: { quarter: 2, month: 6 },
            quarter: { month: 3 },
            week: { day: 7 }
    }
    per[lower] && per[lower][higher]
  end

  ## OK, it does truly suck to have this kind of real-world wallclock timing embedded in the code, but it's
  ## just the most practical way to deal with this at present.
  def daily_batch_running?
    return :night   if Time.now.hour >= 19 && Time.now.hour <= 23  ## the usual period of the nighttime part of the Nightly Load
    return :morning if Time.now.hour >= 6  && Time.now.hour <= 8   ## the usual period of the morning part of the Nightly Load
    false
  end
end
