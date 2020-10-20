module DataPointsHelper

  def dp_superscript(dp)
    days_since_creation = (Time.now.to_date - dp.created_at.to_date).to_i
    "#{days_since_creation}#{'(ph)' if dp.pseudo_history?}"  ## pseudo_history is a model attribute, not a code method
  end

  def dp_age_code(dp)
    days_old = (Time.now.to_date - dp.created_at.to_date).to_i
    case
    when days_old < 99
      days_old.to_s
    when (days_old / 30.0).round < 10
      (days_old / 30.0).round.to_s + 'M'
    else 'XY'
    end
  end
end
