require 'rails_helper'

RSpec.describe "exports/new", type: :view do
  before(:each) do
    assign(:export, Export.new(
      :name => "MyString",
      :created_by => 1,
      :updated_by => 1,
      :owned_by => 1
    ))
  end

  it "renders new export form" do
    render

    assert_select "form[action=?][method=?]", exports_path, "post" do

      assert_select "input#export_name[name=?]", "export[name]"

    end
  end
end
