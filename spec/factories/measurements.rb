FactoryGirl.define do
  factory :measurement do
    prefix "MyString"
    data_portal_name "MyString"
    units_label "MyString"
    units_label_short "MyString"
    percent false
    real false
    notes "MyText"
  end
end
