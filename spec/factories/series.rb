# spec/factories/models.rb
FactoryBot.define do
  factory :xseries do
    frequency { 'year' }
    percent { false }
    seasonal_adjustment { 'not_applicable' }
    restricted { false }
  end

  factory :geography do
    universe { 'UHERO' }
    sequence(:handle) { |n| "GEO#{n}" }  # Ensure uniqueness
    sequence(:display_name) { |n| "Geography #{n}" }
  end

  factory :unit do
    universe { 'UHERO' }
    sequence(:short_label) { |n| "UNIT#{n}" }
    sequence(:long_label) { |n| "Unit Label #{n}" }
  end

  factory :source do
    universe { 'UHERO' }
    sequence(:description) { |n| "Source #{n}" }
  end

  factory :series do
    universe { 'UHERO' }
    sequence(:name) { |n| "SERIES#{n}@GEO1.A" }
    dataPortalName { "Test Series" }
    decimals { 1 }

    # Associations - these ensure each Series gets its own related objects
    association :unit
    association :source
    association :geography
    association :xseries

    # Trait for skipping validations
    trait :skip_validation do
      after(:build) do |series|
        series.scratch = 11011
      end
    end
  end
end
