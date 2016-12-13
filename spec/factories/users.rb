FactoryGirl.define do
  factory :user do
    sequence(:email, 1000) { |n| "person#{n}@example.com" }
    password 'p455word'
    role 'dev'
  end
end
