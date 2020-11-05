module DataPointsHelper

  def dp_superscript(dp)
    days_since_creation = (Time.now.to_date - dp.created_at.to_date).to_i
    "#{days_since_creation}#{'(ph)' if dp.pseudo_history?}"  ## pseudo_history is a model attribute, not a code method
  end

  def dp_display(value, bgcolor, age: nil, title: nil)
    tane = '%.3f' % value
    tane += ' (%s)' % age if age
    styles = 'color:%s; background-color:%s;' % [value < 0 ? 'red' : 'black', bgcolor]
    '<span class="datapoint" title="%s" style="%s">%s</span>'.html_safe % [sanitize(title), styles, tane]
  end

  def dp_age_code(dp)
    days = (Time.now.to_date - dp.created_at.to_date).to_i
    months = (days / 30.0).round
    case
      when  days < 100 then '%02d' % days
      when months < 10 then "#{months}M"
      else
        years = days / 365.0
        years = (years % 1) < 0.80 ? years.to_i : years.to_i + 1
        years = 1 if years == 0
        "#{years}Y"
    end
  end
end
