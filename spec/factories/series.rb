# spec/factories/series.rb
FactoryBot.define do
  factory :series do
    sequence(:name) { |n| "SERIES#{n}@TEST.Q" }
    universe { "TEST" }

    # Associations - make sure these associations match your model requirements
    association :geography
    association :xseries
  end

  factory :xseries do
    # Add necessary xseries attributes
  end

  factory :geography do
    sequence(:handle) { |n| "GEO#{n}" }
    sequence(:display_name) { |n| "Geography #{n}" }
    sequence(:display_name_short) { |n| "Geo#{n}" }
    universe { "TEST" }
  end
end
