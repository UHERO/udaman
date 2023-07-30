module DataPointsHelper

  def dp_display(value, bgcolor, age: nil, title: nil)
    tane = '%.3f' % value
    tane += ' (%s)' % age if age
    styles = 'color:%s; background-color:%s;' % [value < 0 ? '#B81104' : 'black', bgcolor]
    '<span class="datapoint" title="%s" style="%s">%s</span>'.html_safe % [sanitize(strip_tags(title)), styles, tane]
  end

  def dp_age_code(dp)
    days = (Time.now.to_date - dp.created_at.to_date).to_i
    months = (days / 30.0).round
    ('*' if dp.pseudo_history?).to_s +
    case
    when  days < 100 then '%02d' % days
    when months < 10 then "#{months}m"
    else
      years = days / 365.0
      years = (years % 1) < 0.80 ? years.to_i : years.to_i + 1
      years = 1 if years == 0
      "#{years}y"
    end
  end
end
