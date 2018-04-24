module DataPointsHelper

  def dp_superscript(dp)
    days_since_creation = (Time.now.to_date - dp.created_at.to_date).to_i
    "#{days_since_creation}#{'(ph)' if dp.is_pseudo_history?}"
  end
end
