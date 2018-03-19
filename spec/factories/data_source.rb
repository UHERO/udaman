FactoryGirl.define do
  factory :data_source do
    eval "MyString"
    priority 100
    association :series, factory: :series
  end
end
