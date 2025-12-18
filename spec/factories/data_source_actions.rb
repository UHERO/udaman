FactoryBot.define do
  factory :data_source_action do
    data_source_id { 1 }
    series_id { 1 }
    action { 'MyString' }
    eval { 'MyString' }
    priority { 100 }
    created_at { '2018-03-09 22:25:42' }
    user_id { 1 }
  end
end
