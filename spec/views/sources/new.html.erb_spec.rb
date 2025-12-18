require 'rails_helper'

RSpec.describe "sources/new", type: :view do
  before(:each) do
    assign(:source, Source.new(
      :description => "MyString",
      :link => "MyString"
    ))
  end

  it "renders new source form" do
    render

    assert_select "form[action=?][method=?]", sources_path, "post" do

      assert_select "input#source_description[name=?]", "source[description]"

      assert_select "input#source_link[name=?]", "source[link]"
    end
  end
end
